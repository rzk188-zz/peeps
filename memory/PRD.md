# Peeps – Product Requirements Document

## Overview
A cute social mobile app (inspired by Peeps - 與朋友同居, Taiwan) where users sign in with Google, get a cozy shared small house (小屋), customize their avatar's spot, decorate the house with furniture, add friends by 6-char codes, visit each other's houses, and chat 1-on-1.

## Tech Stack
- **Frontend**: Expo SDK 54 (Expo Router), React Native, TypeScript, Traditional Chinese UI
- **Backend**: FastAPI + Motor (MongoDB)
- **Auth**: Emergent-managed Google OAuth (session_token via demobackend.emergentagent.com)
- **Storage**: `@/src/utils/storage` (SecureStore on native, AsyncStorage shim on web)

## Core Features (MVP)
1. **Google Login** – session token verified server-side; user persisted; 6-char friend code generated.
2. **Small House (小屋)** – background room art, draggable/placeable furniture (tap-to-move in 佈置 mode), avatar with name tag.
3. **Friends** – display my friend code; add by code (with friend request flow + auto-accept on mutual request); list friends with visit & chat shortcuts.
4. **Visit Friend's House** – view a friend's decorated room (read-only).
5. **1-on-1 Chat** – send/receive text, poll-based refresh, bubble UI, KeyboardAvoidingView.
6. **Profile** – avatar, name, email, friend code, logout.
7. **Cohabitation 同居模式** – 2-person only. Invite from friends list (auto-accept on mutual invite). Shared house with 5 default items + both avatars (each user moves own avatar slot). Both can place/move/remove furniture. In-house chat room (`cohab::<id>` key). Mode switcher (個人 / 同居) on house screen. Leave-cohab from profile (deletes shared house + cohab chat).

## API Routes (all prefixed `/api`)
- Auth: `POST /auth/session`, `GET /auth/me`, `POST /auth/logout`
- Catalog: `GET /catalog`
- House: `GET /house/me`, `PUT /house/me`, `GET /house/{user_id}` (friends only)
- Friends: `GET /friends`, `POST /friends/add`, `GET /friends/requests`, `POST /friends/requests/{id}/accept`, `POST /friends/requests/{id}/reject`
- Chat: `GET /chat/{user_id}`, `POST /chat/{user_id}`, `GET /chat-list`

## MongoDB Collections
`users`, `user_sessions` (TTL on `expires_at`), `houses`, `friendships`, `friend_requests`, `chat_messages`

## Future enhancements
- Real-time chat via WebSocket
- Group houses (multi-occupant)
- Avatar customization (clothes, expressions)
- Push notifications for messages & visits
- Furniture shop with virtual currency
