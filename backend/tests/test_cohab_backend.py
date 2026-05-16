"""Peeps backend tests for /api/cohab/* (同居模式) plus regression checks.

Seeds users + sessions + friendships directly into MongoDB then drives every cohab
endpoint via HTTP. Each cohab test class uses a dedicated set of users to avoid
cross-contamination from auto-accept and DELETE flows.
"""
import os
import uuid
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient


BASE_URL = os.environ.get(
    "EXPO_BACKEND_URL", "https://peeps-social.preview.emergentagent.com"
).rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
API = f"{BASE_URL}/api"


# ---------- Seed helpers ----------
async def _seed_user(db, suffix: str):
    uid = f"user_{uuid.uuid4().hex[:12]}"
    code = ("CO" + uuid.uuid4().hex[:4]).upper()
    # avoid collision with existing codes
    while await db.users.find_one({"friend_code": code}):
        code = ("CO" + uuid.uuid4().hex[:4]).upper()
    email = f"TEST_COHAB_{suffix}_{uuid.uuid4().hex[:6]}@peeps.test"
    await db.users.insert_one({
        "user_id": uid,
        "email": email,
        "name": f"TEST_COHAB_{suffix}",
        "picture": None,
        "friend_code": code,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    token = f"tok_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": uid,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })
    return {"uid": uid, "code": code, "email": email, "token": token}


async def _add_friendship(db, uid_a: str, uid_b: str):
    await db.friendships.insert_one({
        "friendship_id": str(uuid.uuid4()),
        "user_a": uid_a,
        "user_b": uid_b,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def _cleanup(db, user_ids):
    await db.users.delete_many({"user_id": {"$in": user_ids}})
    await db.user_sessions.delete_many({"user_id": {"$in": user_ids}})
    await db.houses.delete_many({"user_id": {"$in": user_ids}})
    await db.friendships.delete_many({
        "$or": [{"user_a": {"$in": user_ids}}, {"user_b": {"$in": user_ids}}]
    })
    await db.friend_requests.delete_many({
        "$or": [{"from_user_id": {"$in": user_ids}}, {"to_user_id": {"$in": user_ids}}]
    })
    await db.cohab_invites.delete_many({
        "$or": [{"from_user_id": {"$in": user_ids}}, {"to_user_id": {"$in": user_ids}}]
    })
    cohabs = await db.cohabitations.find({
        "$or": [{"user_a": {"$in": user_ids}}, {"user_b": {"$in": user_ids}}]
    }).to_list(1000)
    cohab_ids = [c["cohab_id"] for c in cohabs]
    await db.cohabitations.delete_many({"cohab_id": {"$in": cohab_ids}})
    for cid in cohab_ids:
        await db.chat_messages.delete_many({"chat_key": f"cohab::{cid}"})


@pytest.fixture(scope="module")
def seeded():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    async def setup():
        users = {k: await _seed_user(db, k) for k in
                 ["A", "B", "C", "D", "E", "F", "G", "H", "I"]}
        # Friendships:
        #   A-B (auto-accept cohab pair)
        #   D-E (explicit accept endpoint pair)
        #   F-G (reject pair)
        #   H-I (post-delete re-cohab pair)
        # C remains friendless w.r.t A (for non-friend invite test)
        await _add_friendship(db, users["A"]["uid"], users["B"]["uid"])
        await _add_friendship(db, users["D"]["uid"], users["E"]["uid"])
        await _add_friendship(db, users["F"]["uid"], users["G"]["uid"])
        await _add_friendship(db, users["H"]["uid"], users["I"]["uid"])
        # For regression test: friend A with C via API later
        return users

    users = loop.run_until_complete(setup())
    yield users
    loop.run_until_complete(_cleanup(db, [u["uid"] for u in users.values()]))
    client.close()
    loop.close()


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Cohab core flow: invite + auto-accept ----------
class TestCohabAutoAcceptFlow:
    def test_get_cohab_me_returns_null_initially(self, seeded):
        r = requests.get(f"{API}/cohab/me", headers=auth(seeded["A"]["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body == {"cohab": None, "partner": None}

    def test_invite_self_400(self, seeded):
        r = requests.post(
            f"{API}/cohab/invite",
            json={"to_user_id": seeded["A"]["uid"]},
            headers=auth(seeded["A"]["token"]),
        )
        assert r.status_code == 400
        assert "不能邀請自己" in r.json().get("detail", "")

    def test_invite_non_friend_400(self, seeded):
        # A is NOT friends with C
        r = requests.post(
            f"{API}/cohab/invite",
            json={"to_user_id": seeded["C"]["uid"]},
            headers=auth(seeded["A"]["token"]),
        )
        assert r.status_code == 400
        assert "必須先成為朋友" in r.json().get("detail", "")

    def test_invite_friend_creates_pending(self, seeded):
        # A -> B
        r = requests.post(
            f"{API}/cohab/invite",
            json={"to_user_id": seeded["B"]["uid"]},
            headers=auth(seeded["A"]["token"]),
        )
        assert r.status_code == 200
        assert r.json().get("status") == "sent"

        # B lists invites
        r2 = requests.get(f"{API}/cohab/invites", headers=auth(seeded["B"]["token"]))
        assert r2.status_code == 200
        invites = r2.json()
        match = [i for i in invites if i["from_user_id"] == seeded["A"]["uid"]]
        assert len(match) == 1
        inv = match[0]
        assert inv["status"] == "pending"
        assert inv["to_user_id"] == seeded["B"]["uid"]
        assert inv["from_user"]["user_id"] == seeded["A"]["uid"]
        assert inv["from_user"]["friend_code"] == seeded["A"]["code"]

    def test_reverse_invite_auto_accepts(self, seeded):
        # B -> A triggers auto accept
        r = requests.post(
            f"{API}/cohab/invite",
            json={"to_user_id": seeded["A"]["uid"]},
            headers=auth(seeded["B"]["token"]),
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "accepted"
        cohab = data.get("cohab")
        assert cohab is not None
        # user_a was the original "from" (A), user_b is recipient (B)
        assert cohab["user_a"] == seeded["A"]["uid"]
        assert cohab["user_b"] == seeded["B"]["uid"]
        assert cohab["house_name"] == "我們的同居小屋"
        assert isinstance(cohab["items"], list) and len(cohab["items"]) == 5
        for k in ("avatar_a_x", "avatar_a_y", "avatar_b_x", "avatar_b_y"):
            assert k in cohab and isinstance(cohab[k], (int, float))
        assert "cohab_id" in cohab

    def test_cohab_me_returns_partner_for_both(self, seeded):
        # A's view: partner is B
        r = requests.get(f"{API}/cohab/me", headers=auth(seeded["A"]["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["cohab"]["user_a"] == seeded["A"]["uid"]
        assert body["cohab"]["user_b"] == seeded["B"]["uid"]
        assert body["partner"]["user_id"] == seeded["B"]["uid"]
        assert body["partner"]["email"] == seeded["B"]["email"]

        # B's view: partner is A
        r2 = requests.get(f"{API}/cohab/me", headers=auth(seeded["B"]["token"]))
        assert r2.status_code == 200
        body2 = r2.json()
        assert body2["partner"]["user_id"] == seeded["A"]["uid"]
        assert body2["cohab"]["cohab_id"] == body["cohab"]["cohab_id"]

    def test_invite_when_already_in_cohab_400(self, seeded):
        # A already cohab'd with B; try to invite someone else - need a friend first
        # Use B (already partner) - server should still 400 because A has cohab
        r = requests.post(
            f"{API}/cohab/invite",
            json={"to_user_id": seeded["B"]["uid"]},
            headers=auth(seeded["A"]["token"]),
        )
        assert r.status_code == 400
        assert "你已經有同居對象了" in r.json().get("detail", "")


# ---------- Explicit accept endpoint ----------
class TestCohabExplicitAccept:
    def test_accept_endpoint_creates_cohab(self, seeded):
        # D invites E; E accepts via /accept endpoint (not auto-accept reverse path)
        r = requests.post(
            f"{API}/cohab/invite",
            json={"to_user_id": seeded["E"]["uid"]},
            headers=auth(seeded["D"]["token"]),
        )
        assert r.status_code == 200
        assert r.json()["status"] == "sent"

        # E fetches invites and finds invite_id
        r2 = requests.get(f"{API}/cohab/invites", headers=auth(seeded["E"]["token"]))
        assert r2.status_code == 200
        invites = [i for i in r2.json() if i["from_user_id"] == seeded["D"]["uid"]]
        assert len(invites) == 1
        invite_id = invites[0]["invite_id"]

        r3 = requests.post(
            f"{API}/cohab/invites/{invite_id}/accept",
            headers=auth(seeded["E"]["token"]),
        )
        assert r3.status_code == 200
        data = r3.json()
        assert data["status"] == "accepted"
        assert data["cohab"]["user_a"] == seeded["D"]["uid"]
        assert data["cohab"]["user_b"] == seeded["E"]["uid"]
        assert len(data["cohab"]["items"]) == 5


# ---------- Reject ----------
class TestCohabReject:
    def test_reject_does_not_create_cohab(self, seeded):
        # F invites G; G rejects
        r = requests.post(
            f"{API}/cohab/invite",
            json={"to_user_id": seeded["G"]["uid"]},
            headers=auth(seeded["F"]["token"]),
        )
        assert r.status_code == 200
        assert r.json()["status"] == "sent"

        rl = requests.get(f"{API}/cohab/invites", headers=auth(seeded["G"]["token"]))
        invites = [i for i in rl.json() if i["from_user_id"] == seeded["F"]["uid"]]
        assert invites
        invite_id = invites[0]["invite_id"]

        rr = requests.post(
            f"{API}/cohab/invites/{invite_id}/reject",
            headers=auth(seeded["G"]["token"]),
        )
        assert rr.status_code == 200

        # No cohab created on either side
        for uid_key in ("F", "G"):
            r2 = requests.get(f"{API}/cohab/me", headers=auth(seeded[uid_key]["token"]))
            assert r2.status_code == 200
            assert r2.json() == {"cohab": None, "partner": None}


# ---------- Update (PUT /cohab/me) ----------
class TestCohabUpdate:
    def test_put_items_and_avatar_user_a_slot(self, seeded):
        # A is user_a of the A-B cohab
        new_items = [
            {"item_id": str(uuid.uuid4()), "catalog_id": "lamp", "x": 0.1, "y": 0.2},
            {"item_id": str(uuid.uuid4()), "catalog_id": "cat", "x": 0.8, "y": 0.6},
            {"item_id": str(uuid.uuid4()), "catalog_id": "tv", "x": 0.5, "y": 0.4},
        ]
        # capture B's avatar first
        before = requests.get(f"{API}/cohab/me", headers=auth(seeded["A"]["token"])).json()
        b_x_before = before["cohab"]["avatar_b_x"]
        b_y_before = before["cohab"]["avatar_b_y"]

        r = requests.put(
            f"{API}/cohab/me",
            json={"items": new_items, "avatar_x": 0.12, "avatar_y": 0.34},
            headers=auth(seeded["A"]["token"]),
        )
        assert r.status_code == 200
        data = r.json()
        cohab = data["cohab"]
        assert cohab["avatar_a_x"] == 0.12
        assert cohab["avatar_a_y"] == 0.34
        # B's avatar untouched
        assert cohab["avatar_b_x"] == b_x_before
        assert cohab["avatar_b_y"] == b_y_before
        assert len(cohab["items"]) == 3
        catalog_ids = sorted([i["catalog_id"] for i in cohab["items"]])
        assert catalog_ids == ["cat", "lamp", "tv"]

    def test_put_avatar_user_b_slot(self, seeded):
        # B updating moves avatar_b_*
        before = requests.get(f"{API}/cohab/me", headers=auth(seeded["B"]["token"])).json()
        a_x_before = before["cohab"]["avatar_a_x"]

        r = requests.put(
            f"{API}/cohab/me",
            json={"avatar_x": 0.91, "avatar_y": 0.92},
            headers=auth(seeded["B"]["token"]),
        )
        assert r.status_code == 200
        cohab = r.json()["cohab"]
        assert cohab["avatar_b_x"] == 0.91
        assert cohab["avatar_b_y"] == 0.92
        # A unchanged
        assert cohab["avatar_a_x"] == a_x_before

    def test_put_house_name(self, seeded):
        r = requests.put(
            f"{API}/cohab/me",
            json={"house_name": "TEST_甜蜜小屋"},
            headers=auth(seeded["A"]["token"]),
        )
        assert r.status_code == 200
        assert r.json()["cohab"]["house_name"] == "TEST_甜蜜小屋"

    def test_put_when_no_cohab_404(self, seeded):
        # C has no cohab
        r = requests.put(
            f"{API}/cohab/me",
            json={"house_name": "nope"},
            headers=auth(seeded["C"]["token"]),
        )
        assert r.status_code == 404


# ---------- Chat ----------
class TestCohabChat:
    def test_chat_404_when_no_cohab(self, seeded):
        # C has no cohab
        rg = requests.get(f"{API}/cohab/chat", headers=auth(seeded["C"]["token"]))
        assert rg.status_code == 404
        rp = requests.post(
            f"{API}/cohab/chat", json={"text": "x"},
            headers=auth(seeded["C"]["token"]),
        )
        assert rp.status_code == 404

    def test_chat_send_and_get_sorted(self, seeded):
        msgs = ["TEST_cohab_1", "TEST_cohab_2", "TEST_cohab_3"]
        for m in msgs:
            r = requests.post(
                f"{API}/cohab/chat", json={"text": m},
                headers=auth(seeded["A"]["token"]),
            )
            assert r.status_code == 200
            j = r.json()
            assert j["text"] == m
            assert j["from_user_id"] == seeded["A"]["uid"]
            assert j["to_user_id"] == seeded["B"]["uid"]
            assert j["chat_key"].startswith("cohab::")

        # B replies
        r = requests.post(
            f"{API}/cohab/chat", json={"text": "TEST_cohab_reply"},
            headers=auth(seeded["B"]["token"]),
        )
        assert r.status_code == 200

        # GET from A
        rg = requests.get(f"{API}/cohab/chat", headers=auth(seeded["A"]["token"]))
        assert rg.status_code == 200
        data = rg.json()
        texts = [m["text"] for m in data]
        for m in msgs + ["TEST_cohab_reply"]:
            assert m in texts
        # sorted ascending
        assert data == sorted(data, key=lambda x: x["created_at"])


# ---------- Delete + re-invite ----------
class TestCohabDelete:
    def test_delete_removes_cohab_and_chat(self, seeded):
        # Capture cohab_id for chat-key cleanup verification
        me = requests.get(f"{API}/cohab/me", headers=auth(seeded["A"]["token"])).json()
        cohab_id = me["cohab"]["cohab_id"]

        r = requests.delete(f"{API}/cohab/me", headers=auth(seeded["A"]["token"]))
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # A & B both have no cohab now
        for k in ("A", "B"):
            r2 = requests.get(f"{API}/cohab/me", headers=auth(seeded[k]["token"]))
            assert r2.status_code == 200
            assert r2.json() == {"cohab": None, "partner": None}

        # Chat messages for this cohab should be gone -> GET chat is 404 (no cohab now)
        rc = requests.get(f"{API}/cohab/chat", headers=auth(seeded["A"]["token"]))
        assert rc.status_code == 404

        # Verify chat collection no longer has any messages with that key
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        c = AsyncIOMotorClient(MONGO_URL)
        db = c[DB_NAME]
        count = loop.run_until_complete(
            db.chat_messages.count_documents({"chat_key": f"cohab::{cohab_id}"})
        )
        c.close()
        loop.close()
        assert count == 0

    def test_can_invite_new_cohab_after_delete(self, seeded):
        # H invites I; auto-accept reverse not used. Use explicit accept.
        r = requests.post(
            f"{API}/cohab/invite",
            json={"to_user_id": seeded["I"]["uid"]},
            headers=auth(seeded["H"]["token"]),
        )
        assert r.status_code == 200
        assert r.json()["status"] == "sent"
        rl = requests.get(f"{API}/cohab/invites", headers=auth(seeded["I"]["token"]))
        invite = [i for i in rl.json() if i["from_user_id"] == seeded["H"]["uid"]][0]
        ra = requests.post(
            f"{API}/cohab/invites/{invite['invite_id']}/accept",
            headers=auth(seeded["I"]["token"]),
        )
        assert ra.status_code == 200
        assert ra.json()["cohab"]["user_a"] == seeded["H"]["uid"]


# ---------- Regression: prior endpoints still work ----------
class TestRegression:
    def test_auth_me(self, seeded):
        r = requests.get(f"{API}/auth/me", headers=auth(seeded["A"]["token"]))
        assert r.status_code == 200
        assert r.json()["user_id"] == seeded["A"]["uid"]

    def test_friends_list_includes_b(self, seeded):
        # A-B friendship seeded directly
        r = requests.get(f"{API}/friends", headers=auth(seeded["A"]["token"]))
        assert r.status_code == 200
        ids = [u["user_id"] for u in r.json()]
        assert seeded["B"]["uid"] in ids

    def test_friends_add_creates_pending(self, seeded):
        # A adds C via friend_code -> 'sent'
        r = requests.post(
            f"{API}/friends/add",
            json={"friend_code": seeded["C"]["code"]},
            headers=auth(seeded["A"]["token"]),
        )
        assert r.status_code == 200
        assert r.json()["status"] == "sent"
