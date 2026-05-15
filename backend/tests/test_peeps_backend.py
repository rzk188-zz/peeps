"""Peeps backend integration tests.
Seeds users + sessions directly into MongoDB and exercises all /api endpoints.
"""
import os
import uuid
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient


BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://peeps-social.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

API = f"{BASE_URL}/api"


# ---------- Seed helpers ----------
def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


async def _seed_user(db, friend_code: str, suffix: str):
    uid = f"user_{uuid.uuid4().hex[:12]}"
    email = f"TEST_{suffix}_{uuid.uuid4().hex[:6]}@peeps.test"
    await db.users.insert_one({
        "user_id": uid,
        "email": email,
        "name": f"TEST_{suffix}",
        "picture": None,
        "friend_code": friend_code,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    token = f"tok_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": uid,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })
    return uid, email, token


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
    keys = set()
    for a in user_ids:
        for b in user_ids:
            if a != b:
                keys.add("::".join(sorted([a, b])))
    await db.chat_messages.delete_many({"chat_key": {"$in": list(keys)}})


@pytest.fixture(scope="module")
def seeded():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    code_a = "TSTA" + uuid.uuid4().hex[:2].upper()
    code_b = "TSTB" + uuid.uuid4().hex[:2].upper()
    code_c = "TSTC" + uuid.uuid4().hex[:2].upper()
    uid_a, email_a, tok_a = loop.run_until_complete(_seed_user(db, code_a, "A"))
    uid_b, email_b, tok_b = loop.run_until_complete(_seed_user(db, code_b, "B"))
    uid_c, email_c, tok_c = loop.run_until_complete(_seed_user(db, code_c, "C"))
    data = {
        "A": {"uid": uid_a, "token": tok_a, "code": code_a, "email": email_a},
        "B": {"uid": uid_b, "token": tok_b, "code": code_b, "email": email_b},
        "C": {"uid": uid_c, "token": tok_c, "code": code_c, "email": email_c},
    }
    yield data
    loop.run_until_complete(_cleanup(db, [uid_a, uid_b, uid_c]))
    client.close()
    loop.close()


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Tests ----------
# Root + catalog (public)
class TestPublic:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("message") == "Peeps API"

    def test_catalog(self):
        r = requests.get(f"{API}/catalog")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 12
        ids = [c["catalog_id"] for c in data]
        for must in ["bed", "plant", "table"]:
            assert must in ids


# Auth
class TestAuth:
    def test_session_invalid_token(self):
        r = requests.post(f"{API}/auth/session", json={"session_token": "invalid_xyz_999"})
        assert r.status_code == 401

    def test_me_without_header(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_bearer(self, seeded):
        r = requests.get(f"{API}/auth/me", headers=auth(seeded["A"]["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["user_id"] == seeded["A"]["uid"]
        assert body["email"] == seeded["A"]["email"]
        assert body["friend_code"] == seeded["A"]["code"]


# House
class TestHouse:
    def test_house_me_creates_defaults(self, seeded):
        r = requests.get(f"{API}/house/me", headers=auth(seeded["A"]["token"]))
        assert r.status_code == 200
        body = r.json()
        assert "house" in body and "owner" in body
        items = body["house"]["items"]
        assert len(items) == 3
        cids = sorted([i["catalog_id"] for i in items])
        assert cids == ["bed", "plant", "table"]
        assert body["owner"]["user_id"] == seeded["A"]["uid"]

    def test_house_me_update(self, seeded):
        new_items = [
            {"item_id": str(uuid.uuid4()), "catalog_id": "lamp", "x": 0.2, "y": 0.3},
            {"item_id": str(uuid.uuid4()), "catalog_id": "cat", "x": 0.7, "y": 0.8},
        ]
        payload = {"items": new_items, "avatar_x": 0.42, "avatar_y": 0.55, "house_name": "TEST_House"}
        r = requests.put(f"{API}/house/me", json=payload, headers=auth(seeded["A"]["token"]))
        assert r.status_code == 200
        h = r.json()["house"]
        assert h["avatar_x"] == 0.42
        assert h["avatar_y"] == 0.55
        assert h["house_name"] == "TEST_House"
        assert len(h["items"]) == 2

        # verify persistence
        r2 = requests.get(f"{API}/house/me", headers=auth(seeded["A"]["token"]))
        assert r2.status_code == 200
        h2 = r2.json()["house"]
        assert len(h2["items"]) == 2
        assert h2["avatar_x"] == 0.42

    def test_house_other_403_when_not_friends(self, seeded):
        # C is not friend with A
        r = requests.get(f"{API}/house/{seeded['A']['uid']}", headers=auth(seeded["C"]["token"]))
        assert r.status_code == 403


# Friends
class TestFriends:
    def test_add_friend_sent(self, seeded):
        # A sends request to B (using B's friend code)
        r = requests.post(
            f"{API}/friends/add",
            json={"friend_code": seeded["B"]["code"]},
            headers=auth(seeded["A"]["token"]),
        )
        assert r.status_code == 200
        assert r.json()["status"] == "sent"

    def test_requests_listed_for_b(self, seeded):
        r = requests.get(f"{API}/friends/requests", headers=auth(seeded["B"]["token"]))
        assert r.status_code == 200
        reqs = r.json()
        assert len(reqs) >= 1
        # find request from A
        match = [x for x in reqs if x["from_user_id"] == seeded["A"]["uid"]]
        assert len(match) == 1
        assert match[0]["from_user"]["user_id"] == seeded["A"]["uid"]

    def test_reverse_auto_accept(self, seeded):
        # B adds A back -> auto accept
        r = requests.post(
            f"{API}/friends/add",
            json={"friend_code": seeded["A"]["code"]},
            headers=auth(seeded["B"]["token"]),
        )
        assert r.status_code == 200
        assert r.json()["status"] == "accepted"

        # verify in /friends
        r2 = requests.get(f"{API}/friends", headers=auth(seeded["A"]["token"]))
        assert r2.status_code == 200
        ids = [u["user_id"] for u in r2.json()]
        assert seeded["B"]["uid"] in ids

    def test_house_visible_to_friend(self, seeded):
        r = requests.get(f"{API}/house/{seeded['A']['uid']}", headers=auth(seeded["B"]["token"]))
        assert r.status_code == 200
        assert r.json()["owner"]["user_id"] == seeded["A"]["uid"]

    def test_accept_request_endpoint(self, seeded):
        # C -> A request, A accepts
        r = requests.post(
            f"{API}/friends/add",
            json={"friend_code": seeded["A"]["code"]},
            headers=auth(seeded["C"]["token"]),
        )
        assert r.status_code == 200
        assert r.json()["status"] == "sent"
        # A lists requests
        rl = requests.get(f"{API}/friends/requests", headers=auth(seeded["A"]["token"]))
        assert rl.status_code == 200
        match = [x for x in rl.json() if x["from_user_id"] == seeded["C"]["uid"]]
        assert match, "C->A request not found"
        rid = match[0]["request_id"]
        ra = requests.post(f"{API}/friends/requests/{rid}/accept", headers=auth(seeded["A"]["token"]))
        assert ra.status_code == 200
        # verify friendship
        rf = requests.get(f"{API}/friends", headers=auth(seeded["A"]["token"]))
        assert seeded["C"]["uid"] in [u["user_id"] for u in rf.json()]

    def test_reject_request(self, seeded):
        # New ephemeral B->C request then C rejects
        # First ensure no existing friendship
        r = requests.post(
            f"{API}/friends/add",
            json={"friend_code": seeded["C"]["code"]},
            headers=auth(seeded["B"]["token"]),
        )
        assert r.status_code == 200
        status = r.json()["status"]
        if status != "sent":
            pytest.skip(f"B->C status was {status}; cannot test reject")
        rl = requests.get(f"{API}/friends/requests", headers=auth(seeded["C"]["token"]))
        match = [x for x in rl.json() if x["from_user_id"] == seeded["B"]["uid"]]
        assert match
        rid = match[0]["request_id"]
        rr = requests.post(f"{API}/friends/requests/{rid}/reject", headers=auth(seeded["C"]["token"]))
        assert rr.status_code == 200
        # B and C should NOT be friends
        rf = requests.get(f"{API}/friends", headers=auth(seeded["B"]["token"]))
        assert seeded["C"]["uid"] not in [u["user_id"] for u in rf.json()]


# Chat
class TestChat:
    def test_send_and_get_messages(self, seeded):
        # A and B are friends from prior test
        msgs = ["TEST_hi", "TEST_how_are_you", "TEST_third"]
        for m in msgs:
            r = requests.post(
                f"{API}/chat/{seeded['B']['uid']}",
                json={"text": m},
                headers=auth(seeded["A"]["token"]),
            )
            assert r.status_code == 200
            assert r.json()["text"] == m
        # B replies
        r = requests.post(
            f"{API}/chat/{seeded['A']['uid']}",
            json={"text": "TEST_reply"},
            headers=auth(seeded["B"]["token"]),
        )
        assert r.status_code == 200

        r = requests.get(f"{API}/chat/{seeded['B']['uid']}", headers=auth(seeded["A"]["token"]))
        assert r.status_code == 200
        data = r.json()
        texts = [m["text"] for m in data]
        for m in msgs:
            assert m in texts
        assert "TEST_reply" in texts
        # sorted ascending by created_at
        assert data == sorted(data, key=lambda x: x["created_at"])

    def test_chat_list(self, seeded):
        r = requests.get(f"{API}/chat-list", headers=auth(seeded["A"]["token"]))
        assert r.status_code == 200
        data = r.json()
        # A has friends B and C
        friend_ids = [d["friend"]["user_id"] for d in data]
        assert seeded["B"]["uid"] in friend_ids
        # entry for B should have a last_message
        b_entry = [d for d in data if d["friend"]["user_id"] == seeded["B"]["uid"]][0]
        assert b_entry["last_message"] is not None
        assert "text" in b_entry["last_message"]


# Logout (run last)
class TestLogout:
    def test_logout_deletes_session(self, seeded):
        # Use C's token, then verify it stops working
        tok = seeded["C"]["token"]
        r = requests.post(f"{API}/auth/logout", headers=auth(tok))
        assert r.status_code == 200
        # Subsequent auth/me should be 401
        r2 = requests.get(f"{API}/auth/me", headers=auth(tok))
        assert r2.status_code == 401
