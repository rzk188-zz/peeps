"""Peeps backend tests for the customizable avatar appearance feature.

Covers:
- DEFAULT_APPEARANCE shape (8 fields)
- New users get appearance on creation (validated via direct PUT default-merge behavior)
- Back-fill: a seeded user without appearance gets defaults after first PUT
- GET /api/auth/me returns appearance
- PUT /api/auth/appearance auth gate (401)
- Partial merge: only specified fields change
- Full body persists
- Unknown extra fields ignored
- /cohab/me partner.appearance included
- /friends list items include appearance
"""
import os
import uuid
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient


BASE_URL = os.environ.get(
    "EXPO_BACKEND_URL",
    os.environ.get(
        "EXPO_PUBLIC_BACKEND_URL",
        "https://peeps-social.preview.emergentagent.com",
    ),
).rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
API = f"{BASE_URL}/api"


DEFAULT_APPEARANCE = {
    "skin": "#FFE0BD",
    "eyes": "round",
    "eye_color": "#3D2C1E",
    "hair_style": "short",
    "hair_color": "#3D2C1E",
    "shirt_style": "tee",
    "shirt_color": "#FFB5B5",
    "pants_color": "#7BB8E0",
}
APPEARANCE_FIELDS = list(DEFAULT_APPEARANCE.keys())


# ---------- Seed helpers ----------
async def _seed_user(db, suffix: str, include_appearance: bool = True):
    uid = f"user_{uuid.uuid4().hex[:12]}"
    code = ("AP" + uuid.uuid4().hex[:4]).upper()
    while await db.users.find_one({"friend_code": code}):
        code = ("AP" + uuid.uuid4().hex[:4]).upper()
    email = f"TEST_APP_{suffix}_{uuid.uuid4().hex[:6]}@peeps.test"
    doc = {
        "user_id": uid,
        "email": email,
        "name": f"TEST_APP_{suffix}",
        "picture": None,
        "friend_code": code,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if include_appearance:
        doc["appearance"] = dict(DEFAULT_APPEARANCE)
    await db.users.insert_one(doc)
    token = f"tok_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": uid,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })
    return {"uid": uid, "code": code, "email": email, "token": token}


async def _add_friendship(db, a, b):
    await db.friendships.insert_one({
        "friendship_id": str(uuid.uuid4()),
        "user_a": a,
        "user_b": b,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def _seed_cohab(db, a, b):
    cohab = {
        "cohab_id": str(uuid.uuid4()),
        "user_a": a,
        "user_b": b,
        "house_name": "TEST_APP_HOUSE",
        "items": [],
        "avatar_a_x": 0.3, "avatar_a_y": 0.7,
        "avatar_b_x": 0.7, "avatar_b_y": 0.7,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.cohabitations.insert_one(dict(cohab))
    return cohab["cohab_id"]


async def _cleanup(db, uids):
    await db.users.delete_many({"user_id": {"$in": uids}})
    await db.user_sessions.delete_many({"user_id": {"$in": uids}})
    await db.houses.delete_many({"user_id": {"$in": uids}})
    await db.friendships.delete_many({
        "$or": [{"user_a": {"$in": uids}}, {"user_b": {"$in": uids}}]
    })
    await db.cohabitations.delete_many({
        "$or": [{"user_a": {"$in": uids}}, {"user_b": {"$in": uids}}]
    })


@pytest.fixture(scope="module")
def seeded():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    async def setup():
        users = {
            "A": await _seed_user(db, "A", include_appearance=True),
            "B": await _seed_user(db, "B", include_appearance=True),
            # legacy user with NO appearance field (back-fill candidate)
            "L": await _seed_user(db, "LEGACY", include_appearance=False),
            "F1": await _seed_user(db, "F1", include_appearance=True),
            "F2": await _seed_user(db, "F2", include_appearance=True),
        }
        # friendships for friends-list test
        await _add_friendship(db, users["F1"]["uid"], users["F2"]["uid"])
        # cohab between A and B (for /cohab/me partner.appearance test)
        await _seed_cohab(db, users["A"]["uid"], users["B"]["uid"])
        return users

    users = loop.run_until_complete(setup())
    yield users
    loop.run_until_complete(_cleanup(db, [u["uid"] for u in users.values()]))
    client.close()
    loop.close()


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Tests ----------
class TestDefaultAppearance:
    def test_default_constant_shape(self):
        assert set(DEFAULT_APPEARANCE.keys()) == {
            "skin", "eyes", "eye_color", "hair_style", "hair_color",
            "shirt_style", "shirt_color", "pants_color",
        }

    def test_me_includes_appearance(self, seeded):
        r = requests.get(f"{API}/auth/me", headers=auth(seeded["A"]["token"]))
        assert r.status_code == 200
        body = r.json()
        assert "appearance" in body, "user missing appearance field"
        for k in APPEARANCE_FIELDS:
            assert k in body["appearance"], f"missing appearance.{k}"
        # default seeded user matches defaults
        assert body["appearance"] == DEFAULT_APPEARANCE


class TestAppearanceAuthGate:
    def test_put_appearance_no_auth_401(self):
        r = requests.put(f"{API}/auth/appearance", json={"skin": "#000000"})
        assert r.status_code == 401

    def test_put_appearance_bad_token_401(self):
        r = requests.put(
            f"{API}/auth/appearance",
            json={"skin": "#000000"},
            headers={"Authorization": "Bearer not_a_real_token"},
        )
        assert r.status_code == 401


class TestAppearancePartialMerge:
    def test_partial_update_only_changes_specified(self, seeded):
        # A starts with defaults
        payload = {"hair_color": "#FF0000", "shirt_color": "#00FF00"}
        r = requests.put(
            f"{API}/auth/appearance",
            json=payload,
            headers=auth(seeded["A"]["token"]),
        )
        assert r.status_code == 200
        user = r.json()
        assert "appearance" in user
        app = user["appearance"]
        assert app["hair_color"] == "#FF0000"
        assert app["shirt_color"] == "#00FF00"
        # unchanged fields remain at default
        for k in APPEARANCE_FIELDS:
            if k in payload:
                continue
            assert app[k] == DEFAULT_APPEARANCE[k], f"field {k} should be unchanged"

        # GET /auth/me reflects update
        r2 = requests.get(f"{API}/auth/me", headers=auth(seeded["A"]["token"]))
        assert r2.status_code == 200
        app2 = r2.json()["appearance"]
        assert app2["hair_color"] == "#FF0000"
        assert app2["shirt_color"] == "#00FF00"

    def test_full_body_persists(self, seeded):
        full = {
            "skin": "#A0522D",
            "eyes": "happy",
            "eye_color": "#000000",
            "hair_style": "long",
            "hair_color": "#FFD700",
            "shirt_style": "hoodie",
            "shirt_color": "#123456",
            "pants_color": "#654321",
        }
        r = requests.put(
            f"{API}/auth/appearance",
            json=full,
            headers=auth(seeded["B"]["token"]),
        )
        assert r.status_code == 200
        assert r.json()["appearance"] == full

        # round-trip via /me
        r2 = requests.get(f"{API}/auth/me", headers=auth(seeded["B"]["token"]))
        assert r2.json()["appearance"] == full

    def test_unknown_field_ignored(self, seeded):
        r = requests.put(
            f"{API}/auth/appearance",
            json={"skin": "#111111", "not_a_real_field": "xxx", "evil": 42},
            headers=auth(seeded["B"]["token"]),
        )
        assert r.status_code == 200, f"unknown field should be ignored, got {r.status_code}: {r.text}"
        app = r.json()["appearance"]
        assert app["skin"] == "#111111"
        assert "not_a_real_field" not in app
        assert "evil" not in app
        # still exactly 8 fields
        assert set(app.keys()) == set(APPEARANCE_FIELDS)


class TestAppearanceBackfill:
    def test_legacy_user_me_no_appearance_initially(self, seeded):
        # Legacy user was seeded WITHOUT appearance.
        r = requests.get(f"{API}/auth/me", headers=auth(seeded["L"]["token"]))
        assert r.status_code == 200
        body = r.json()
        # Either back-filled to default or simply absent. Document current behavior.
        if "appearance" in body:
            # if present it must be defaults
            assert body["appearance"] == DEFAULT_APPEARANCE
        else:
            assert "appearance" not in body  # no auto back-fill on /me itself

    def test_put_appearance_creates_field_when_missing(self, seeded):
        # PUT on legacy user should create the appearance field using defaults
        # merged with the partial payload.
        r = requests.put(
            f"{API}/auth/appearance",
            json={"skin": "#DEADBE"},
            headers=auth(seeded["L"]["token"]),
        )
        assert r.status_code == 200
        user = r.json()
        assert "appearance" in user
        app = user["appearance"]
        assert app["skin"] == "#DEADBE"
        # Other fields filled from default
        for k in APPEARANCE_FIELDS:
            if k == "skin":
                continue
            assert app[k] == DEFAULT_APPEARANCE[k], f"backfill missing for {k}"

        # Persisted on /me
        r2 = requests.get(f"{API}/auth/me", headers=auth(seeded["L"]["token"]))
        assert r2.json()["appearance"]["skin"] == "#DEADBE"


class TestCohabPartnerAppearance:
    def test_cohab_me_includes_partner_appearance(self, seeded):
        r = requests.get(f"{API}/cohab/me", headers=auth(seeded["A"]["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body.get("partner") is not None, f"no partner returned: {body}"
        assert body["partner"]["user_id"] == seeded["B"]["uid"]
        assert "appearance" in body["partner"], "partner.appearance missing in /cohab/me"
        app = body["partner"]["appearance"]
        for k in APPEARANCE_FIELDS:
            assert k in app


class TestFriendsAppearance:
    def test_friends_list_items_include_appearance(self, seeded):
        r = requests.get(f"{API}/friends", headers=auth(seeded["F1"]["token"]))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        target = [u for u in data if u["user_id"] == seeded["F2"]["uid"]]
        assert target, "F2 not in F1's friends list"
        assert "appearance" in target[0], "friend missing appearance field"
        for k in APPEARANCE_FIELDS:
            assert k in target[0]["appearance"]
