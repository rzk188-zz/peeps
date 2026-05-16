import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageBackground,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, getToken, BACKEND_URL } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, ISO_FURNITURE, ROOM_BG, FURNITURE_EMOJI } from "@/src/theme";
import { Avatar } from "@/src/components/Avatar";
import { Joystick } from "@/src/components/Joystick";

type Item = { item_id: string; catalog_id: string; x: number; y: number };
type RemoteUser = { user_id: string; name: string; appearance: any; x: number; y: number; walking: boolean };

const MOVE_SPEED = 0.011;
const TICK_MS = 33;
const WS_THROTTLE_MS = 80;
const AVATAR_SIZE = 100;

export default function HouseScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"solo" | "cohab">("solo");
  const [cohabData, setCohabData] = useState<any>(null);
  const [house, setHouse] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [avatarPos, setAvatarPos] = useState({ x: 0.5, y: 0.6 });
  const [walking, setWalking] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [roomSize, setRoomSize] = useState({ w: 0, h: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState<Record<string, RemoteUser>>({});

  const isCohab = mode === "cohab" && !!cohabData?.cohab;
  const stickRef = useRef({ x: 0, y: 0 });
  const tickerRef = useRef<any>(null);
  const lastSentRef = useRef(0);
  const lastSavedPosRef = useRef({ x: 0.5, y: 0.6 });
  const wsRef = useRef<WebSocket | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [solo, c] = await Promise.all([api.getMyHouse(), api.cohabMe()]);
      setHouse(solo.house);
      if (c?.cohab) {
        setCohabData(c);
        setMode((m) => (m === "solo" ? "cohab" : m));
        applyCohab(c);
      } else {
        setCohabData(null);
        setMode("solo");
        setItems(solo.house.items || []);
        const p = { x: solo.house.avatar_x ?? 0.5, y: solo.house.avatar_y ?? 0.6 };
        setAvatarPos(p);
        lastSavedPosRef.current = p;
      }
    } catch (e: any) {
      Alert.alert("錯誤", e.message);
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyCohab = (c: any) => {
    setItems(c.cohab.items || []);
    const isA = c.cohab.user_a === user?.user_id;
    const my = {
      x: isA ? c.cohab.avatar_a_x ?? 0.4 : c.cohab.avatar_b_x ?? 0.6,
      y: isA ? c.cohab.avatar_a_y ?? 0.6 : c.cohab.avatar_b_y ?? 0.6,
    };
    setAvatarPos(my);
    lastSavedPosRef.current = my;
  };

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));
  useEffect(() => { api.catalog().then(setCatalog).catch(() => {}); }, []);

  // WebSocket connect when mode/room ready
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    let ws: WebSocket | null = null;

    const connect = async () => {
      const token = await getToken();
      if (!token) return;
      const roomKey = isCohab ? `cohab::${cohabData?.cohab?.cohab_id}` : `solo::${user.user_id}`;
      const wsUrl = (BACKEND_URL || "").replace(/^http/, "ws") + "/api/ws/room";
      try {
        ws = new WebSocket(wsUrl);
      } catch { return; }
      wsRef.current = ws;
      ws.onopen = () => {
        ws?.send(JSON.stringify({
          type: "join",
          token,
          room_key: roomKey,
          x: avatarPos.x,
          y: avatarPos.y,
        }));
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (cancelled) return;
          if (msg.type === "state") {
            const map: Record<string, RemoteUser> = {};
            for (const u of msg.users) map[u.user_id] = u;
            setRemoteUsers(map);
          } else if (msg.type === "join") {
            setRemoteUsers((p) => ({ ...p, [msg.user_id]: msg }));
          } else if (msg.type === "leave") {
            setRemoteUsers((p) => { const n = { ...p }; delete n[msg.user_id]; return n; });
          } else if (msg.type === "move") {
            setRemoteUsers((p) => ({
              ...p,
              [msg.user_id]: { ...(p[msg.user_id] || { name: "", appearance: null }), ...msg },
            }));
          }
        } catch {}
      };
      ws.onclose = () => { if (wsRef.current === ws) wsRef.current = null; };
      ws.onerror = () => {};
    };
    connect();
    return () => {
      cancelled = true;
      try { ws?.close(); } catch {}
      wsRef.current = null;
      setRemoteUsers({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.user_id, mode, cohabData?.cohab?.cohab_id, isCohab]);

  const sendMove = useCallback((x: number, y: number, isWalking: boolean) => {
    const now = Date.now();
    if (now - lastSentRef.current < WS_THROTTLE_MS && !isWalking !== true) return;
    lastSentRef.current = now;
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify({ type: "move", x, y, walking: isWalking })); } catch {}
    }
  }, []);

  const switchMode = (m: "solo" | "cohab") => {
    setMode(m); setSelectedId(null); setEditMode(false);
    if (m === "solo" && house) {
      setItems(house.items || []);
      const p = { x: house.avatar_x ?? 0.5, y: house.avatar_y ?? 0.6 };
      setAvatarPos(p); lastSavedPosRef.current = p;
    } else if (m === "cohab" && cohabData) applyCohab(cohabData);
  };

  const saveAvatarPos = useCallback(async (x: number, y: number) => {
    try {
      if (isCohab) await api.updateCohab({ avatar_x: x, avatar_y: y });
      else await api.updateMyHouse({ items, avatar_x: x, avatar_y: y });
      lastSavedPosRef.current = { x, y };
    } catch {}
  }, [isCohab, items]);

  const persistItems = async (nextItems: Item[]) => {
    try {
      if (isCohab) {
        const r = await api.updateCohab({ items: nextItems, avatar_x: avatarPos.x, avatar_y: avatarPos.y });
        setCohabData(r);
      } else {
        await api.updateMyHouse({ items: nextItems, avatar_x: avatarPos.x, avatar_y: avatarPos.y });
      }
    } catch (e: any) { Alert.alert("儲存失敗", e.message); }
  };

  useEffect(() => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = setInterval(() => {
      const { x: jx, y: jy } = stickRef.current;
      const moving = jx !== 0 || jy !== 0;
      if (!moving) return;
      setAvatarPos((p) => {
        const nx = Math.max(0.08, Math.min(0.92, p.x + jx * MOVE_SPEED));
        const ny = Math.max(0.25, Math.min(0.88, p.y + jy * MOVE_SPEED));
        sendMove(nx, ny, true);
        return { x: nx, y: ny };
      });
    }, TICK_MS);
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, [sendMove]);

  const onJoystickMove = (dx: number, dy: number) => {
    stickRef.current = { x: dx, y: dy };
    setWalking(dx !== 0 || dy !== 0);
  };
  const onJoystickRelease = () => {
    setWalking(false);
    const { x, y } = avatarPos;
    sendMove(x, y, false);
    const last = lastSavedPosRef.current;
    if (Math.abs(x - last.x) > 0.01 || Math.abs(y - last.y) > 0.01) saveAvatarPos(x, y);
  };

  const onRoomPress = (e: any) => {
    if (!editMode || !selectedId) return;
    const { locationX, locationY } = e.nativeEvent;
    const x = Math.max(0.05, Math.min(0.95, locationX / roomSize.w));
    const y = Math.max(0.1, Math.min(0.92, locationY / roomSize.h));
    const next = items.map((it) => (it.item_id === selectedId ? { ...it, x, y } : it));
    setItems(next); persistItems(next);
  };

  const addItem = (catalog_id: string) => {
    const newItem: Item = { item_id: `${catalog_id}_${Date.now()}`, catalog_id, x: 0.5, y: 0.5 };
    const next = [...items, newItem];
    setItems(next); setSelectedId(newItem.item_id); setCatalogOpen(false); persistItems(next);
  };

  const removeItem = (id: string) => {
    const next = items.filter((it) => it.item_id !== id);
    setItems(next); setSelectedId(null); persistItems(next);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  // Z-sort items and avatars by Y for proper 2.5D occlusion
  const sortedItems = [...items].sort((a, b) => a.y - b.y);
  const allCharacters: Array<{ id: string; x: number; y: number; appearance: any; name: string; walking: boolean; isMe?: boolean }> = [
    { id: "me", x: avatarPos.x, y: avatarPos.y, appearance: user?.appearance, name: user?.name || "我", walking, isMe: true },
    ...Object.values(remoteUsers).map((u) => ({ id: u.user_id, x: u.x, y: u.y, appearance: u.appearance, name: u.name, walking: u.walking })),
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>嗨，{user?.name?.split(" ")[0] || "你"} 👋</Text>
          <Text style={styles.houseTitle} numberOfLines={1}>
            {isCohab ? cohabData?.cohab?.house_name : house?.house_name || "我的小屋"} {isCohab ? "💞" : ""}
          </Text>
        </View>
        <TouchableOpacity
          testID="edit-mode-toggle"
          style={[styles.editBtn, editMode && styles.editBtnActive]}
          onPress={() => { setEditMode((v) => !v); setSelectedId(null); }}
        >
          <Ionicons name={editMode ? "checkmark" : "create-outline"} size={20} color={editMode ? "#fff" : colors.text} />
          <Text style={[styles.editBtnText, editMode && { color: "#fff" }]}>
            {editMode ? "完成" : "佈置"}
          </Text>
        </TouchableOpacity>
      </View>

      {cohabData?.cohab && (
        <View style={styles.modeSwitch}>
          <TouchableOpacity
            testID="mode-solo"
            style={[styles.modePill, mode === "solo" && styles.modePillActive]}
            onPress={() => switchMode("solo")}
          >
            <Ionicons name="person" size={14} color={mode === "solo" ? "#fff" : colors.text} />
            <Text style={[styles.modeText, mode === "solo" && { color: "#fff" }]}>個人</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="mode-cohab"
            style={[styles.modePill, mode === "cohab" && styles.modePillActiveCohab]}
            onPress={() => switchMode("cohab")}
          >
            <Ionicons name="heart" size={14} color={mode === "cohab" ? "#fff" : colors.text} />
            <Text style={[styles.modeText, mode === "cohab" && { color: "#fff" }]}>
              同居 ({cohabData.partner?.name})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.roomWrap}>
        <Pressable
          testID="room-canvas"
          onLayout={(e) => setRoomSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          onPress={onRoomPress}
          style={styles.room}
        >
          <ImageBackground source={{ uri: ROOM_BG }} style={styles.bg} resizeMode="cover">
            {/* Render iso items, sorted by y for z-order */}
            {sortedItems.map((it) => {
              const isSelected = selectedId === it.item_id;
              const url = ISO_FURNITURE[it.catalog_id];
              const itemSize = 80;
              return (
                <Pressable
                  key={it.item_id}
                  testID={`furniture-${it.catalog_id}`}
                  style={[
                    styles.furniture,
                    { left: it.x * roomSize.w - itemSize / 2, top: it.y * roomSize.h - itemSize / 2, width: itemSize, height: itemSize },
                    isSelected && styles.furnitureSelected,
                  ]}
                  onPress={(e) => { e.stopPropagation?.(); if (editMode) setSelectedId(it.item_id); }}
                >
                  {url ? (
                    <Image source={{ uri: url }} style={{ width: itemSize, height: itemSize }} resizeMode="contain" />
                  ) : (
                    <Text style={styles.furnitureEmoji}>{FURNITURE_EMOJI[it.catalog_id] || "📦"}</Text>
                  )}
                  {isSelected && editMode && (
                    <TouchableOpacity testID="remove-furniture" style={styles.removeBtn} onPress={() => removeItem(it.item_id)}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </Pressable>
              );
            })}

            {/* Render characters (sorted by y for 2.5D occlusion) */}
            {allCharacters
              .sort((a, b) => a.y - b.y)
              .map((c) => (
                <CharacterSprite
                  key={c.id}
                  x={c.x * roomSize.w}
                  y={c.y * roomSize.h}
                  appearance={c.appearance}
                  name={c.name}
                  walking={c.walking}
                  isMe={c.isMe}
                />
              ))}
          </ImageBackground>
        </Pressable>

        {editMode && (
          <View style={styles.editHint}>
            <Text style={styles.editHintText}>
              {selectedId ? "點房間移動傢俱" : "點選傢俱再點房間"}
            </Text>
          </View>
        )}

        {!editMode && (
          <View style={styles.joystickWrap} pointerEvents="box-none">
            <Joystick size={104} onMove={onJoystickMove} onRelease={onJoystickRelease} />
          </View>
        )}

        {isCohab && !editMode && (
          <TouchableOpacity testID="cohab-chat-fab" style={styles.fab} onPress={() => router.push("/cohab-chat")}>
            <Ionicons name="chatbubbles" size={20} color="#fff" />
            <Text style={styles.fabText}>同居聊天</Text>
          </TouchableOpacity>
        )}

        {/* Online indicator */}
        {Object.keys(remoteUsers).length > 0 && (
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>{Object.keys(remoteUsers).length + 1} 人在線</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity testID="add-furniture-btn" style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => setCatalogOpen(true)}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.actionText}>傢俱</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="customize-btn" style={[styles.actionBtn, { backgroundColor: colors.green }]} onPress={() => router.push("/customize")}>
          <Ionicons name="color-palette" size={20} color="#fff" />
          <Text style={styles.actionText}>換裝</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="visit-friends-btn" style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={() => router.push("/(tabs)/friends")}>
          <Ionicons name="people" size={20} color={colors.text} />
          <Text style={[styles.actionText, { color: colors.text }]}>朋友</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={catalogOpen} transparent animationType="slide" onRequestClose={() => setCatalogOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCatalogOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>選擇傢俱</Text>
            <ScrollView contentContainerStyle={styles.catalogGrid}>
              {catalog.map((c) => {
                const iso = ISO_FURNITURE[c.catalog_id];
                return (
                  <TouchableOpacity
                    key={c.catalog_id}
                    testID={`catalog-${c.catalog_id}`}
                    style={styles.catalogItem}
                    onPress={() => addItem(c.catalog_id)}
                  >
                    {iso ? (
                      <Image source={{ uri: iso }} style={{ width: 60, height: 60 }} resizeMode="contain" />
                    ) : (
                      <Text style={styles.catalogEmoji}>{c.emoji}</Text>
                    )}
                    <Text style={styles.catalogName}>{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/** Smoothly interpolates to (x,y) when target changes. */
function CharacterSprite({
  x, y, appearance, name, walking, isMe,
}: { x: number; y: number; appearance: any; name: string; walking: boolean; isMe?: boolean }) {
  const ax = useRef(new Animated.Value(x)).current;
  const ay = useRef(new Animated.Value(y)).current;
  const idleY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ax, { toValue: x, duration: 140, useNativeDriver: false }),
      Animated.timing(ay, { toValue: y, duration: 140, useNativeDriver: false }),
    ]).start();
  }, [x, y, ax, ay]);

  // Idle subtle bobbing
  useEffect(() => {
    if (walking) {
      idleY.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idleY, { toValue: -3, duration: 1100, useNativeDriver: false }),
        Animated.timing(idleY, { toValue: 0, duration: 1100, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [walking, idleY]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: Animated.subtract(ax, AVATAR_SIZE / 2) as unknown as number,
        top: Animated.add(Animated.subtract(ay, AVATAR_SIZE * 1.25 + 10), idleY) as unknown as number,
        alignItems: "center",
      }}
    >
      <Avatar appearance={appearance} size={AVATAR_SIZE} walking={walking} />
      <View style={[charStyles.tag, isMe && { backgroundColor: colors.primary }]}>
        <Text style={charStyles.tagText} numberOfLines={1}>{name}</Text>
      </View>
    </Animated.View>
  );
}

const charStyles = StyleSheet.create({
  tag: { backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, marginTop: -6, maxWidth: 110 },
  tagText: { color: colors.text, fontWeight: "800", fontSize: 11 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { fontSize: 14, color: colors.textSoft, fontWeight: "600" },
  houseTitle: { fontSize: 24, fontWeight: "900", color: colors.text, marginTop: 2 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 2, borderColor: colors.border },
  editBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  editBtnText: { fontWeight: "800", color: colors.text },
  modeSwitch: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 6 },
  modePill: { flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  modePillActive: { backgroundColor: colors.text, borderColor: colors.text },
  modePillActiveCohab: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeText: { fontWeight: "800", color: colors.text, fontSize: 13 },
  roomWrap: { flex: 1, paddingHorizontal: 16 },
  room: { flex: 1, borderRadius: 32, overflow: "hidden", backgroundColor: colors.accent },
  bg: { flex: 1, position: "relative" },
  furniture: { position: "absolute", alignItems: "center", justifyContent: "center" },
  furnitureSelected: { borderWidth: 3, borderColor: colors.primary, borderRadius: 12 },
  furnitureEmoji: { fontSize: 38 },
  removeBtn: { position: "absolute", top: -8, right: -8, backgroundColor: "#E74C3C", width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  editHint: { position: "absolute", top: 16, left: 32, right: 32, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 },
  editHintText: { color: "#fff", fontWeight: "700", textAlign: "center", fontSize: 13 },
  joystickWrap: { position: "absolute", left: 24, bottom: 18 },
  fab: { position: "absolute", right: 28, bottom: 22, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999 },
  fabText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  onlineBadge: { position: "absolute", top: 12, right: 28, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  onlineText: { fontWeight: "800", fontSize: 11, color: colors.text },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 20 },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 20, maxHeight: "70%" },
  modalHandle: { width: 50, height: 5, backgroundColor: colors.border, borderRadius: 3, alignSelf: "center" },
  modalTitle: { fontSize: 22, fontWeight: "900", color: colors.text, marginTop: 16, marginBottom: 16 },
  catalogGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  catalogItem: { width: "30%", aspectRatio: 1, backgroundColor: colors.bg, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 2, borderColor: colors.border },
  catalogEmoji: { fontSize: 38 },
  catalogName: { fontWeight: "700", fontSize: 12, color: colors.text },
});
