from fastapi import FastAPI, APIRouter, HTTPException, Header, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import string
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Models ----------
class SessionRequest(BaseModel):
    session_token: str

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    friend_code: str
    created_at: str

class FurnitureItem(BaseModel):
    item_id: str
    catalog_id: str  # e.g. 'bed', 'plant'
    x: float  # 0..1 relative
    y: float  # 0..1 relative

class HouseUpdate(BaseModel):
    items: List[FurnitureItem]
    avatar_x: Optional[float] = 0.5
    avatar_y: Optional[float] = 0.7
    house_name: Optional[str] = None

class FriendAddRequest(BaseModel):
    friend_code: str

class ChatSend(BaseModel):
    text: str

class CohabInviteCreate(BaseModel):
    to_user_id: str

class CohabHouseUpdate(BaseModel):
    items: Optional[List[FurnitureItem]] = None
    avatar_x: Optional[float] = None
    avatar_y: Optional[float] = None
    house_name: Optional[str] = None


# ---------- Helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def gen_friend_code() -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

async def get_current_user(authorization: Optional[str]) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization[7:]
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session.get("expires_at")
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def ensure_house(user_id: str):
    existing = await db.houses.find_one({"user_id": user_id}, {"_id": 0})
    if existing:
        return existing
    default_items = [
        {"item_id": str(uuid.uuid4()), "catalog_id": "bed", "x": 0.25, "y": 0.55},
        {"item_id": str(uuid.uuid4()), "catalog_id": "plant", "x": 0.78, "y": 0.6},
        {"item_id": str(uuid.uuid4()), "catalog_id": "table", "x": 0.55, "y": 0.7},
    ]
    house = {
        "user_id": user_id,
        "house_name": "我的小屋",
        "items": default_items,
        "avatar_x": 0.5,
        "avatar_y": 0.75,
        "updated_at": now_iso(),
    }
    await db.houses.insert_one(dict(house))
    house.pop("_id", None)
    return house


# ---------- Auth ----------
@api_router.post("/auth/session")
async def create_session(body: SessionRequest):
    """Verify session_token from Emergent auth, upsert user, store session."""
    async with httpx.AsyncClient() as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_token},
            timeout=15.0,
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session token")
    data = r.json()
    email = data.get("email")
    name = data.get("name") or email
    picture = data.get("picture")
    if not email:
        raise HTTPException(status_code=400, detail="Missing email")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        # ensure unique friend code
        friend_code = gen_friend_code()
        while await db.users.find_one({"friend_code": friend_code}):
            friend_code = gen_friend_code()
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "friend_code": friend_code,
            "created_at": now_iso(),
        }
        await db.users.insert_one(dict(user))
        user.pop("_id", None)
    else:
        # refresh name/picture
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"name": name, "picture": picture}},
        )
        user["name"] = name
        user["picture"] = picture

    await ensure_house(user["user_id"])

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session_doc = {
        "session_token": data.get("session_token") or body.session_token,
        "user_id": user["user_id"],
        "created_at": now_iso(),
        "expires_at": expires_at,
    }
    await db.user_sessions.update_one(
        {"session_token": session_doc["session_token"]},
        {"$set": session_doc},
        upsert=True,
    )
    return {
        "session_token": session_doc["session_token"],
        "user": user,
    }


@api_router.get("/auth/me")
async def get_me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    return user


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------- Catalog ----------
CATALOG = [
    {"catalog_id": "bed", "name": "舒適小床", "emoji": "🛏️"},
    {"catalog_id": "plant", "name": "綠色植栽", "emoji": "🪴"},
    {"catalog_id": "table", "name": "圓茶几", "emoji": "🪑"},
    {"catalog_id": "lamp", "name": "落地燈", "emoji": "💡"},
    {"catalog_id": "tv", "name": "電視", "emoji": "📺"},
    {"catalog_id": "book", "name": "書本", "emoji": "📚"},
    {"catalog_id": "cake", "name": "蛋糕", "emoji": "🍰"},
    {"catalog_id": "music", "name": "音響", "emoji": "🎵"},
    {"catalog_id": "cat", "name": "貓咪", "emoji": "🐱"},
    {"catalog_id": "dog", "name": "狗狗", "emoji": "🐶"},
    {"catalog_id": "heart", "name": "愛心", "emoji": "💖"},
    {"catalog_id": "star", "name": "星星", "emoji": "⭐"},
]

@api_router.get("/catalog")
async def get_catalog():
    return CATALOG


# ---------- House ----------
@api_router.get("/house/me")
async def get_my_house(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    house = await ensure_house(user["user_id"])
    return {"house": house, "owner": user}


@api_router.put("/house/me")
async def update_my_house(body: HouseUpdate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    update = {
        "items": [i.dict() for i in body.items],
        "avatar_x": body.avatar_x if body.avatar_x is not None else 0.5,
        "avatar_y": body.avatar_y if body.avatar_y is not None else 0.7,
        "updated_at": now_iso(),
    }
    if body.house_name is not None:
        update["house_name"] = body.house_name
    await db.houses.update_one({"user_id": user["user_id"]}, {"$set": update}, upsert=True)
    house = await db.houses.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"house": house}


@api_router.get("/house/{user_id}")
async def get_user_house(user_id: str, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # Allow if friend or self
    if user_id != me["user_id"]:
        f = await db.friendships.find_one({
            "$or": [
                {"user_a": me["user_id"], "user_b": user_id},
                {"user_a": user_id, "user_b": me["user_id"]},
            ]
        })
        if not f:
            raise HTTPException(status_code=403, detail="Not friends")
    house = await ensure_house(user_id)
    return {"house": house, "owner": target}


# ---------- Friends ----------
@api_router.get("/friends")
async def list_friends(authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    rels = await db.friendships.find({
        "$or": [{"user_a": me["user_id"]}, {"user_b": me["user_id"]}]
    }, {"_id": 0}).to_list(1000)
    friend_ids = [r["user_b"] if r["user_a"] == me["user_id"] else r["user_a"] for r in rels]
    if not friend_ids:
        return []
    friends = await db.users.find({"user_id": {"$in": friend_ids}}, {"_id": 0}).to_list(1000)
    return friends


@api_router.post("/friends/add")
async def add_friend(body: FriendAddRequest, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    code = body.friend_code.strip().upper()
    if code == me["friend_code"]:
        raise HTTPException(status_code=400, detail="不能加自己")
    target = await db.users.find_one({"friend_code": code}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="找不到此朋友代碼")
    # already friends?
    existing = await db.friendships.find_one({
        "$or": [
            {"user_a": me["user_id"], "user_b": target["user_id"]},
            {"user_a": target["user_id"], "user_b": me["user_id"]},
        ]
    })
    if existing:
        return {"status": "already_friends", "user": target}
    # pending request?
    pending = await db.friend_requests.find_one({
        "from_user_id": me["user_id"],
        "to_user_id": target["user_id"],
        "status": "pending",
    })
    if pending:
        return {"status": "pending"}
    # If they already sent to me, auto-accept
    reverse = await db.friend_requests.find_one({
        "from_user_id": target["user_id"],
        "to_user_id": me["user_id"],
        "status": "pending",
    })
    if reverse:
        await db.friend_requests.update_one(
            {"request_id": reverse["request_id"]}, {"$set": {"status": "accepted"}}
        )
        await db.friendships.insert_one({
            "friendship_id": str(uuid.uuid4()),
            "user_a": me["user_id"],
            "user_b": target["user_id"],
            "created_at": now_iso(),
        })
        return {"status": "accepted", "user": target}
    # create request
    req = {
        "request_id": str(uuid.uuid4()),
        "from_user_id": me["user_id"],
        "to_user_id": target["user_id"],
        "status": "pending",
        "created_at": now_iso(),
    }
    await db.friend_requests.insert_one(dict(req))
    return {"status": "sent"}


@api_router.get("/friends/requests")
async def list_requests(authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    reqs = await db.friend_requests.find(
        {"to_user_id": me["user_id"], "status": "pending"}, {"_id": 0}
    ).to_list(1000)
    from_ids = [r["from_user_id"] for r in reqs]
    senders = await db.users.find({"user_id": {"$in": from_ids}}, {"_id": 0}).to_list(1000)
    sender_map = {u["user_id"]: u for u in senders}
    return [
        {**r, "from_user": sender_map.get(r["from_user_id"])}
        for r in reqs
    ]


@api_router.post("/friends/requests/{request_id}/accept")
async def accept_request(request_id: str, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    req = await db.friend_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req or req["to_user_id"] != me["user_id"]:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.friend_requests.update_one(
        {"request_id": request_id}, {"$set": {"status": "accepted"}}
    )
    await db.friendships.insert_one({
        "friendship_id": str(uuid.uuid4()),
        "user_a": req["from_user_id"],
        "user_b": me["user_id"],
        "created_at": now_iso(),
    })
    return {"ok": True}


@api_router.post("/friends/requests/{request_id}/reject")
async def reject_request(request_id: str, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    req = await db.friend_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req or req["to_user_id"] != me["user_id"]:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.friend_requests.update_one(
        {"request_id": request_id}, {"$set": {"status": "rejected"}}
    )
    return {"ok": True}


# ---------- Chat ----------
def chat_key(a: str, b: str) -> str:
    return "::".join(sorted([a, b]))

@api_router.get("/chat/{user_id}")
async def get_chat(user_id: str, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    key = chat_key(me["user_id"], user_id)
    msgs = await db.chat_messages.find({"chat_key": key}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return msgs


@api_router.post("/chat/{user_id}")
async def send_chat(user_id: str, body: ChatSend, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    msg = {
        "message_id": str(uuid.uuid4()),
        "chat_key": chat_key(me["user_id"], user_id),
        "from_user_id": me["user_id"],
        "to_user_id": user_id,
        "text": body.text,
        "created_at": now_iso(),
    }
    await db.chat_messages.insert_one(dict(msg))
    msg.pop("_id", None)
    return msg


@api_router.get("/chat-list")
async def list_chats(authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    # all friends + latest message
    rels = await db.friendships.find({
        "$or": [{"user_a": me["user_id"]}, {"user_b": me["user_id"]}]
    }, {"_id": 0}).to_list(1000)
    friend_ids = [r["user_b"] if r["user_a"] == me["user_id"] else r["user_a"] for r in rels]
    friends = await db.users.find({"user_id": {"$in": friend_ids}}, {"_id": 0}).to_list(1000)
    out = []
    for f in friends:
        key = chat_key(me["user_id"], f["user_id"])
        last = await db.chat_messages.find_one({"chat_key": key}, {"_id": 0}, sort=[("created_at", -1)])
        out.append({"friend": f, "last_message": last})
    out.sort(key=lambda x: (x["last_message"] or {}).get("created_at", ""), reverse=True)
    return out


@api_router.get("/")
async def root():
    return {"message": "Peeps API"}


# ---------- Cohabitation ----------
async def get_my_cohab(user_id: str) -> Optional[Dict[str, Any]]:
    return await db.cohabitations.find_one(
        {"$or": [{"user_a": user_id}, {"user_b": user_id}]}, {"_id": 0}
    )

async def assemble_cohab_view(cohab: Dict[str, Any], me_id: str) -> Dict[str, Any]:
    partner_id = cohab["user_b"] if cohab["user_a"] == me_id else cohab["user_a"]
    partner = await db.users.find_one({"user_id": partner_id}, {"_id": 0})
    return {"cohab": cohab, "partner": partner}


@api_router.get("/cohab/me")
async def get_cohab_me(authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    cohab = await get_my_cohab(me["user_id"])
    if not cohab:
        return {"cohab": None, "partner": None}
    return await assemble_cohab_view(cohab, me["user_id"])


@api_router.post("/cohab/invite")
async def invite_cohab(body: CohabInviteCreate, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    if body.to_user_id == me["user_id"]:
        raise HTTPException(status_code=400, detail="不能邀請自己")
    target = await db.users.find_one({"user_id": body.to_user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="找不到使用者")
    friendship = await db.friendships.find_one({
        "$or": [
            {"user_a": me["user_id"], "user_b": body.to_user_id},
            {"user_a": body.to_user_id, "user_b": me["user_id"]},
        ]
    })
    if not friendship:
        raise HTTPException(status_code=400, detail="必須先成為朋友")
    if await get_my_cohab(me["user_id"]):
        raise HTTPException(status_code=400, detail="你已經有同居對象了")
    if await get_my_cohab(body.to_user_id):
        raise HTTPException(status_code=400, detail="對方已經有同居對象了")
    # If they already invited me -> auto accept
    reverse = await db.cohab_invites.find_one({
        "from_user_id": body.to_user_id,
        "to_user_id": me["user_id"],
        "status": "pending",
    })
    if reverse:
        return await _accept_cohab(reverse["invite_id"], me["user_id"])
    existing = await db.cohab_invites.find_one({
        "from_user_id": me["user_id"],
        "to_user_id": body.to_user_id,
        "status": "pending",
    })
    if existing:
        return {"status": "pending"}
    invite = {
        "invite_id": str(uuid.uuid4()),
        "from_user_id": me["user_id"],
        "to_user_id": body.to_user_id,
        "status": "pending",
        "created_at": now_iso(),
    }
    await db.cohab_invites.insert_one(dict(invite))
    return {"status": "sent"}


@api_router.get("/cohab/invites")
async def list_cohab_invites(authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    invites = await db.cohab_invites.find(
        {"to_user_id": me["user_id"], "status": "pending"}, {"_id": 0}
    ).to_list(1000)
    from_ids = [i["from_user_id"] for i in invites]
    senders = await db.users.find({"user_id": {"$in": from_ids}}, {"_id": 0}).to_list(1000)
    sender_map = {u["user_id"]: u for u in senders}
    return [{**i, "from_user": sender_map.get(i["from_user_id"])} for i in invites]


async def _accept_cohab(invite_id: str, me_id: str):
    invite = await db.cohab_invites.find_one({"invite_id": invite_id}, {"_id": 0})
    if not invite or invite["to_user_id"] != me_id:
        raise HTTPException(status_code=404, detail="邀請不存在")
    if invite["status"] != "pending":
        raise HTTPException(status_code=400, detail="此邀請已處理")
    if await get_my_cohab(me_id) or await get_my_cohab(invite["from_user_id"]):
        await db.cohab_invites.update_one(
            {"invite_id": invite_id}, {"$set": {"status": "rejected"}}
        )
        raise HTTPException(status_code=400, detail="其中一方已有同居對象")
    await db.cohab_invites.update_one(
        {"invite_id": invite_id}, {"$set": {"status": "accepted"}}
    )
    # seed default items
    default_items = [
        {"item_id": str(uuid.uuid4()), "catalog_id": "bed", "x": 0.25, "y": 0.55},
        {"item_id": str(uuid.uuid4()), "catalog_id": "bed", "x": 0.75, "y": 0.55},
        {"item_id": str(uuid.uuid4()), "catalog_id": "table", "x": 0.5, "y": 0.7},
        {"item_id": str(uuid.uuid4()), "catalog_id": "plant", "x": 0.85, "y": 0.45},
        {"item_id": str(uuid.uuid4()), "catalog_id": "heart", "x": 0.5, "y": 0.35},
    ]
    cohab = {
        "cohab_id": str(uuid.uuid4()),
        "user_a": invite["from_user_id"],
        "user_b": me_id,
        "house_name": "我們的同居小屋",
        "items": default_items,
        "avatar_a_x": 0.35,
        "avatar_a_y": 0.78,
        "avatar_b_x": 0.65,
        "avatar_b_y": 0.78,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.cohabitations.insert_one(dict(cohab))
    cohab.pop("_id", None)
    return {"status": "accepted", "cohab": cohab}


@api_router.post("/cohab/invites/{invite_id}/accept")
async def accept_cohab(invite_id: str, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    return await _accept_cohab(invite_id, me["user_id"])


@api_router.post("/cohab/invites/{invite_id}/reject")
async def reject_cohab(invite_id: str, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    invite = await db.cohab_invites.find_one({"invite_id": invite_id}, {"_id": 0})
    if not invite or invite["to_user_id"] != me["user_id"]:
        raise HTTPException(status_code=404, detail="邀請不存在")
    await db.cohab_invites.update_one(
        {"invite_id": invite_id}, {"$set": {"status": "rejected"}}
    )
    return {"ok": True}


@api_router.put("/cohab/me")
async def update_cohab(body: CohabHouseUpdate, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    cohab = await get_my_cohab(me["user_id"])
    if not cohab:
        raise HTTPException(status_code=404, detail="尚未同居")
    update = {"updated_at": now_iso()}
    if body.items is not None:
        update["items"] = [i.dict() for i in body.items]
    if body.house_name is not None:
        update["house_name"] = body.house_name
    # which avatar slot is mine?
    is_a = cohab["user_a"] == me["user_id"]
    if body.avatar_x is not None:
        update["avatar_a_x" if is_a else "avatar_b_x"] = body.avatar_x
    if body.avatar_y is not None:
        update["avatar_a_y" if is_a else "avatar_b_y"] = body.avatar_y
    await db.cohabitations.update_one({"cohab_id": cohab["cohab_id"]}, {"$set": update})
    fresh = await db.cohabitations.find_one({"cohab_id": cohab["cohab_id"]}, {"_id": 0})
    return await assemble_cohab_view(fresh, me["user_id"])


@api_router.delete("/cohab/me")
async def leave_cohab(authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    cohab = await get_my_cohab(me["user_id"])
    if not cohab:
        return {"ok": True}
    await db.cohabitations.delete_one({"cohab_id": cohab["cohab_id"]})
    await db.chat_messages.delete_many({"chat_key": f"cohab::{cohab['cohab_id']}"})
    return {"ok": True}


@api_router.get("/cohab/chat")
async def get_cohab_chat(authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    cohab = await get_my_cohab(me["user_id"])
    if not cohab:
        raise HTTPException(status_code=404, detail="尚未同居")
    key = f"cohab::{cohab['cohab_id']}"
    msgs = await db.chat_messages.find({"chat_key": key}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return msgs


@api_router.post("/cohab/chat")
async def send_cohab_chat(body: ChatSend, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    cohab = await get_my_cohab(me["user_id"])
    if not cohab:
        raise HTTPException(status_code=404, detail="尚未同居")
    partner_id = cohab["user_b"] if cohab["user_a"] == me["user_id"] else cohab["user_a"]
    msg = {
        "message_id": str(uuid.uuid4()),
        "chat_key": f"cohab::{cohab['cohab_id']}",
        "from_user_id": me["user_id"],
        "to_user_id": partner_id,
        "text": body.text,
        "created_at": now_iso(),
    }
    await db.chat_messages.insert_one(dict(msg))
    msg.pop("_id", None)
    return msg


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.users.create_index("friend_code", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    except Exception as e:
        logger.warning(f"index init: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
