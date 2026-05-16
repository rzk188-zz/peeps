"""Peeps backend tests for /api/ws/room (realtime room websocket).

Covers all bullets from review_request iteration 4:
- Connect without join message -> server disconnects within 10s
- Bad/invalid token -> close code 4001
- Missing room_key -> close code 4001
- Unknown room_key prefix -> close 4002
- solo::self -> success, state with empty users
- solo::non_friend -> close 4003
- solo::friend -> success
- cohab::<my_cohab> -> success
- cohab::<other_cohab> -> close 4003
- cohab::unknown -> close 4003
- Two users same room: join broadcast + state with other in initial list (second joiner)
- move broadcast to other client
- disconnect -> remaining clients receive leave
- ping -> pong

Plus regression:
- GET /api/catalog returns 15 items including 'chair','sofa','rug'
"""
import os
import json
import uuid
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import pytest_asyncio
import requests
import websockets
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

# Build wss/ws URL from BASE_URL
if BASE_URL.startswith("https://"):
    WS_URL = "wss://" + BASE_URL[len("https://"):] + "/api/ws/room"
elif BASE_URL.startswith("http://"):
    WS_URL = "ws://" + BASE_URL[len("http://"):] + "/api/ws/room"
else:
    WS_URL = BASE_URL + "/api/ws/room"


TEST_PREFIX = "TEST_WS_"


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------- Seed helpers ----------
async def _seed_user(db, suffix: str):
    uid = f"user_{uuid.uuid4().hex[:12]}"
    code = ("WS" + uuid.uuid4().hex[:4]).upper()
    while await db.users.find_one({"friend_code": code}):
        code = ("WS" + uuid.uuid4().hex[:4]).upper()
    email = f"{TEST_PREFIX}{suffix}_{uuid.uuid4().hex[:6]}@peeps.test"
    doc = {
        "user_id": uid,
        "email": email,
        "name": f"{TEST_PREFIX}{suffix}",
        "picture": None,
        "friend_code": code,
        "appearance": {
            "skin": "#FFE0BD", "eyes": "round", "eye_color": "#3D2C1E",
            "hair_style": "short", "hair_color": "#3D2C1E",
            "shirt_style": "tee", "shirt_color": "#FFB5B5", "pants_color": "#7BB8E0",
        },
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = f"tok_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": uid,
        "created_at": now_iso(),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })
    return uid, email, token


@pytest_asyncio.fixture(scope="module")
async def seeded():
    """Seed users:
       A, B (friends), C (no friendship to A/B),
       cohab between A & B partners? No -- cohabitation needs separate pair.
       Make X & Y cohabitants. Z is non-member.
    """
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    a_id, a_email, a_tok = await _seed_user(db, "A")
    b_id, b_email, b_tok = await _seed_user(db, "B")
    c_id, c_email, c_tok = await _seed_user(db, "C")
    x_id, x_email, x_tok = await _seed_user(db, "X")
    y_id, y_email, y_tok = await _seed_user(db, "Y")
    z_id, z_email, z_tok = await _seed_user(db, "Z")

    # friendship A<->B
    await db.friendships.insert_one({
        "friendship_id": str(uuid.uuid4()),
        "user_a": a_id, "user_b": b_id,
        "created_at": now_iso(),
    })
    # cohabitation X<->Y
    cohab_id = str(uuid.uuid4())
    await db.cohabitations.insert_one({
        "cohab_id": cohab_id,
        "user_a": x_id, "user_b": y_id,
        "house_name": "TEST_WS cohab",
        "items": [],
        "avatar_a_x": 0.35, "avatar_a_y": 0.78,
        "avatar_b_x": 0.65, "avatar_b_y": 0.78,
        "created_at": now_iso(), "updated_at": now_iso(),
    })

    data = {
        "a": {"id": a_id, "token": a_tok, "email": a_email},
        "b": {"id": b_id, "token": b_tok, "email": b_email},
        "c": {"id": c_id, "token": c_tok, "email": c_email},
        "x": {"id": x_id, "token": x_tok, "email": x_email},
        "y": {"id": y_id, "token": y_tok, "email": y_email},
        "z": {"id": z_id, "token": z_tok, "email": z_email},
        "cohab_id": cohab_id,
    }
    yield data

    # Cleanup
    ids = [a_id, b_id, c_id, x_id, y_id, z_id]
    emails = [a_email, b_email, c_email, x_email, y_email, z_email]
    await db.users.delete_many({"user_id": {"$in": ids}})
    await db.user_sessions.delete_many({"user_id": {"$in": ids}})
    await db.friendships.delete_many({"$or": [
        {"user_a": {"$in": ids}}, {"user_b": {"$in": ids}}
    ]})
    await db.cohabitations.delete_one({"cohab_id": cohab_id})
    await db.houses.delete_many({"user_id": {"$in": ids}})


# ---------- WS helpers ----------
async def _connect():
    return await websockets.connect(WS_URL, open_timeout=10, ping_interval=None)


async def _join(ws, token, room_key):
    await ws.send(json.dumps({"type": "join", "token": token, "room_key": room_key}))


async def _recv_json(ws, timeout=5):
    raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
    return json.loads(raw)


async def _recv_until(ws, mtype, timeout=5):
    """Read messages until one with type==mtype arrives, return it."""
    deadline = asyncio.get_event_loop().time() + timeout
    while True:
        remaining = deadline - asyncio.get_event_loop().time()
        if remaining <= 0:
            raise asyncio.TimeoutError(f"timeout waiting for {mtype}")
        raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
        m = json.loads(raw)
        if m.get("type") == mtype:
            return m


# ---------- Regression: catalog ----------
class TestCatalogRegression:
    def test_catalog_has_15_items_with_new_furniture(self):
        r = requests.get(f"{API}/catalog", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 15
        ids = {i["catalog_id"] for i in data}
        for required in ("chair", "sofa", "rug"):
            assert required in ids, f"missing {required} in catalog"


# ---------- WS tests ----------
class TestWsConnect:
    @pytest.mark.asyncio
    async def test_no_join_message_disconnects_within_10s(self):
        ws = await _connect()
        try:
            # Don't send anything. Server should close within ~10s (asyncio.wait_for timeout=10).
            with pytest.raises(websockets.exceptions.ConnectionClosed):
                await asyncio.wait_for(ws.recv(), timeout=15)
        finally:
            try:
                await ws.close()
            except Exception:
                pass

    @pytest.mark.asyncio
    async def test_bad_token_closes_4001(self, seeded):
        ws = await _connect()
        try:
            await _join(ws, "tok_invalid_xxxx", f"solo::{seeded['a']['id']}")
            with pytest.raises(websockets.exceptions.ConnectionClosed) as ei:
                await asyncio.wait_for(ws.recv(), timeout=5)
            assert ei.value.code == 4001
        finally:
            try: await ws.close()
            except Exception: pass

    @pytest.mark.asyncio
    async def test_missing_room_key_closes_4001(self, seeded):
        ws = await _connect()
        try:
            await ws.send(json.dumps({"type": "join", "token": seeded["a"]["token"]}))
            with pytest.raises(websockets.exceptions.ConnectionClosed) as ei:
                await asyncio.wait_for(ws.recv(), timeout=5)
            assert ei.value.code == 4001
        finally:
            try: await ws.close()
            except Exception: pass

    @pytest.mark.asyncio
    async def test_unknown_room_prefix_closes_4002(self, seeded):
        ws = await _connect()
        try:
            await _join(ws, seeded["a"]["token"], "weird::abc")
            with pytest.raises(websockets.exceptions.ConnectionClosed) as ei:
                await asyncio.wait_for(ws.recv(), timeout=5)
            assert ei.value.code == 4002
        finally:
            try: await ws.close()
            except Exception: pass

    @pytest.mark.asyncio
    async def test_first_msg_wrong_type_closes_4000(self, seeded):
        ws = await _connect()
        try:
            await ws.send(json.dumps({"type": "ping"}))
            with pytest.raises(websockets.exceptions.ConnectionClosed) as ei:
                await asyncio.wait_for(ws.recv(), timeout=5)
            assert ei.value.code == 4000
        finally:
            try: await ws.close()
            except Exception: pass


class TestWsSoloAuthz:
    @pytest.mark.asyncio
    async def test_solo_self_success_with_empty_state(self, seeded):
        ws = await _connect()
        try:
            await _join(ws, seeded["a"]["token"], f"solo::{seeded['a']['id']}")
            msg = await _recv_json(ws, timeout=5)
            assert msg["type"] == "state"
            assert msg["users"] == []
        finally:
            await ws.close()

    @pytest.mark.asyncio
    async def test_solo_non_friend_closes_4003(self, seeded):
        # C tries to join A's solo room (no friendship)
        ws = await _connect()
        try:
            await _join(ws, seeded["c"]["token"], f"solo::{seeded['a']['id']}")
            with pytest.raises(websockets.exceptions.ConnectionClosed) as ei:
                await asyncio.wait_for(ws.recv(), timeout=5)
            assert ei.value.code == 4003
        finally:
            try: await ws.close()
            except Exception: pass

    @pytest.mark.asyncio
    async def test_solo_friend_success(self, seeded):
        # B is friend of A, joins solo::A
        ws = await _connect()
        try:
            await _join(ws, seeded["b"]["token"], f"solo::{seeded['a']['id']}")
            msg = await _recv_json(ws, timeout=5)
            assert msg["type"] == "state"
            assert isinstance(msg["users"], list)
        finally:
            await ws.close()


class TestWsCohabAuthz:
    @pytest.mark.asyncio
    async def test_cohab_member_success(self, seeded):
        ws = await _connect()
        try:
            await _join(ws, seeded["x"]["token"], f"cohab::{seeded['cohab_id']}")
            msg = await _recv_json(ws, timeout=5)
            assert msg["type"] == "state"
        finally:
            await ws.close()

    @pytest.mark.asyncio
    async def test_cohab_non_member_closes_4003(self, seeded):
        ws = await _connect()
        try:
            await _join(ws, seeded["z"]["token"], f"cohab::{seeded['cohab_id']}")
            with pytest.raises(websockets.exceptions.ConnectionClosed) as ei:
                await asyncio.wait_for(ws.recv(), timeout=5)
            assert ei.value.code == 4003
        finally:
            try: await ws.close()
            except Exception: pass

    @pytest.mark.asyncio
    async def test_cohab_unknown_id_closes_4003(self, seeded):
        ws = await _connect()
        try:
            await _join(ws, seeded["x"]["token"], "cohab::nonexistent_xyz")
            with pytest.raises(websockets.exceptions.ConnectionClosed) as ei:
                await asyncio.wait_for(ws.recv(), timeout=5)
            assert ei.value.code == 4003
        finally:
            try: await ws.close()
            except Exception: pass


class TestWsTwoClients:
    @pytest.mark.asyncio
    async def test_two_users_join_state_and_broadcasts(self, seeded):
        room = f"solo::{seeded['a']['id']}"
        ws_a = await _connect()
        ws_b = await _connect()
        try:
            # A joins own room
            await _join(ws_a, seeded["a"]["token"], room)
            state_a = await _recv_json(ws_a, timeout=5)
            assert state_a["type"] == "state"
            assert state_a["users"] == []

            # B (friend) joins same room
            await _join(ws_b, seeded["b"]["token"], room)
            state_b = await _recv_json(ws_b, timeout=5)
            assert state_b["type"] == "state"
            user_ids = [u["user_id"] for u in state_b["users"]]
            assert seeded["a"]["id"] in user_ids, f"A should be in B's initial state, got {user_ids}"

            # A should receive 'join' broadcast for B
            join_evt = await _recv_until(ws_a, "join", timeout=5)
            assert join_evt["user_id"] == seeded["b"]["id"]

            # B sends move; A receives
            await ws_b.send(json.dumps({"type": "move", "x": 0.3, "y": 0.7, "walking": True}))
            mv = await _recv_until(ws_a, "move", timeout=5)
            assert mv["user_id"] == seeded["b"]["id"]
            assert abs(mv["x"] - 0.3) < 1e-6
            assert abs(mv["y"] - 0.7) < 1e-6
            assert mv["walking"] is True

            # B sends ping; B gets pong (not broadcast)
            await ws_b.send(json.dumps({"type": "ping"}))
            pong = await _recv_until(ws_b, "pong", timeout=5)
            assert pong["type"] == "pong"

            # B disconnects; A receives leave
            await ws_b.close()
            leave_evt = await _recv_until(ws_a, "leave", timeout=8)
            assert leave_evt["user_id"] == seeded["b"]["id"]
        finally:
            for w in (ws_a, ws_b):
                try: await w.close()
                except Exception: pass
