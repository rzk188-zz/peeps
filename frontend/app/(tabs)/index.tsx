import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, PIXEL_FURNITURE_URLS, FURNITURE_EMOJI } from "@/src/theme";
import { Avatar } from "@/src/components/Avatar";
import { Joystick } from "@/src/components/Joystick";

type Item = { item_id: string; catalog_id: string; x: number; y: number };

const MOVE_SPEED = 0.012;
const TICK_MS = 33;

const TABS = [
  { id: "char", label: "角色", icon: "person" as const },
  { id: "pet", label: "寵物", icon: "paw" as const },
  { id: "game", label: "遊戲", icon: "game-controller" as const },
  { id: "gacha", label: "扭蛋", icon: "egg" as const },
];

export default function HouseScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"solo" | "cohab">("solo");
  const [cohabData, setCohabData] = useState<any>(null);
  const [house, setHouse] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [avatarPos, setAvatarPos] = useState({ x: 0.5, y: 0.6 });
  const [partnerPos, setPartnerPos] = useState({ x: 0.6, y: 0.6 });
  const [editMode, setEditMode] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [roomSize, setRoomSize] = useState({ w: 0, h: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("char");
  const [chatText, setChatText] = useState("");

  const isCohab = mode === "cohab" && !!cohabData?.cohab;
  const stickRef = useRef({ x: 0, y: 0 });
  const tickerRef = useRef<any>(null);
  const lastSavedPosRef = useRef({ x: 0.5, y: 0.6 });

  const loadAll = useCallback(async () => {
    try {
      const [solo, c, fr] = await Promise.all([
        api.getMyHouse(),
        api.cohabMe(),
        api.listFriends(),
      ]);
      setHouse(solo.house);
      setFriends(fr);
      if (c?.cohab) {
        setCohabData(c);
        setMode((m) => (m === "solo" && !cohabData ? "cohab" : m));
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
    } finally {
      setLoading(false);
    }
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
    setPartnerPos({
      x: isA ? c.cohab.avatar_b_x ?? 0.6 : c.cohab.avatar_a_x ?? 0.4,
      y: isA ? c.cohab.avatar_b_y ?? 0.6 : c.cohab.avatar_a_y ?? 0.6,
    });
  };

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));
  useEffect(() => { api.catalog().then(setCatalog).catch(() => {}); }, []);

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
      if (jx === 0 && jy === 0) return;
      setAvatarPos((p) => ({
        x: Math.max(0.08, Math.min(0.92, p.x + jx * MOVE_SPEED)),
        y: Math.max(0.15, Math.min(0.9, p.y + jy * MOVE_SPEED)),
      }));
    }, TICK_MS);
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, []);

  const onJoystickMove = (dx: number, dy: number) => { stickRef.current = { x: dx, y: dy }; };
  const onJoystickRelease = () => {
    const { x, y } = avatarPos;
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

  const sendMsg = async () => {
    if (!chatText.trim()) return;
    if (!isCohab) {
      Alert.alert("還沒同居", "去好友列表邀請朋友同居後即可在這裡聊天");
      return;
    }
    const t = chatText; setChatText("");
    try { await api.sendCohabChat(t); } catch { setChatText(t); }
  };

  if (loading) {
    return (
      <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
    );
  }

  const houseLevel = Math.max(1, Math.floor((items?.length || 0) / 3));
  const coins = 700;
  const energy = 15;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topGroup}>
          <TouchableOpacity style={styles.iconPill} testID="settings-btn" onPress={() => router.push("/(tabs)/profile")}>
            <Ionicons name="settings-outline" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconPill} testID="album-btn">
            <Ionicons name="image-outline" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.nameBox} onPress={() => cohabData?.cohab && switchMode(mode === "solo" ? "cohab" : "solo")}>
          <Text style={styles.nameText} numberOfLines={1}>
            {isCohab ? cohabData?.cohab?.house_name || "同居小屋" : user?.name || "你"}
          </Text>
          {cohabData?.cohab && <Ionicons name="chevron-down" size={14} color={colors.textSoft} />}
        </TouchableOpacity>
        <View style={styles.topGroup}>
          <TouchableOpacity style={styles.iconPill} testID="history-btn">
            <Ionicons name="time-outline" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconPill} testID="chat-btn" onPress={() => router.push("/(tabs)/chat")}>
            <Ionicons name="chatbubble-outline" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Friend ring row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ringRow}>
        <RingSlot label="任務" sub="拍照" iconEmoji="📷" />
        <RingSlot
          label="你"
          sub={`⚡ ${energy}`}
          dot
          active
          avatar={<Avatar appearance={user?.appearance} size={46} />}
          onPress={() => router.push("/customize")}
        />
        {friends.slice(0, 3).map((f) => (
          <RingSlot
            key={f.user_id}
            label={f.name?.split(" ")[0] || "朋友"}
            sub={`⚡ ${Math.floor(Math.random() * 20)}`}
            avatar={<Avatar appearance={f.appearance} size={46} />}
            onPress={() => router.push(`/house/${f.user_id}`)}
          />
        ))}
        <RingSlot label="邀請" iconEmoji="+" plus onPress={() => router.push("/(tabs)/friends")} />
      </ScrollView>

      {/* Room (tan area) */}
      <View style={styles.roomShell}>
        {/* Stats bar inside room */}
        <View style={styles.statsBar}>
          <View style={styles.statPill}>
            <Ionicons name="diamond" size={11} color="#A0A0A0" />
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statEmoji}>🏠</Text>
            <Text style={styles.statText}>Lv {houseLevel}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={[styles.statEmoji, { color: colors.primary }]}>●</Text>
            <Text style={styles.statText}>{coins}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={[styles.statEmoji, { color: colors.pink }]}>●</Text>
            <Text style={styles.statText}>0</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={[styles.statEmoji, { color: colors.accent }]}>⚡</Text>
            <Text style={styles.statText}>{energy}</Text>
          </View>
        </View>

        {/* Tab pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.id}
              testID={`tab-${t.id}`}
              style={[styles.tabPill, tab === t.id && styles.tabPillActive]}
              onPress={() => {
                setTab(t.id);
                if (t.id === "char") router.push("/customize");
                else if (t.id === "game") setCatalogOpen(true);
              }}
            >
              <Ionicons name={t.icon} size={12} color={tab === t.id ? colors.bg : colors.text} />
              <Text style={[styles.tabText, tab === t.id && { color: colors.bg }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            testID="edit-mode-toggle"
            style={[styles.tabPill, editMode && styles.tabPillActive]}
            onPress={() => { setEditMode((v) => !v); setSelectedId(null); }}
          >
            <Ionicons name={editMode ? "checkmark" : "create-outline"} size={12} color={editMode ? colors.bg : colors.text} />
            <Text style={[styles.tabText, editMode && { color: colors.bg }]}>{editMode ? "完成" : "佈置"}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Room canvas */}
        <Pressable
          testID="room-canvas"
          onLayout={(e) => setRoomSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          onPress={onRoomPress}
          style={styles.room}
        >
          {/* Items */}
          {items.map((it) => {
            const isSelected = selectedId === it.item_id;
            const url = PIXEL_FURNITURE_URLS[it.catalog_id];
            return (
              <Pressable
                key={it.item_id}
                testID={`furniture-${it.catalog_id}`}
                style={[
                  styles.furniture,
                  { left: it.x * roomSize.w - 24, top: it.y * roomSize.h - 24 },
                  isSelected && styles.furnitureSelected,
                ]}
                onPress={(e) => { e.stopPropagation?.(); if (editMode) setSelectedId(it.item_id); }}
              >
                {url ? (
                  <Image source={{ uri: url }} style={styles.furnitureImg} resizeMode="contain" />
                ) : (
                  <Text style={styles.furnitureEmoji}>{FURNITURE_EMOJI[it.catalog_id] || "📦"}</Text>
                )}
                {isSelected && editMode && (
                  <TouchableOpacity testID="remove-furniture" style={styles.removeBtn} onPress={() => removeItem(it.item_id)}>
                    <Ionicons name="close" size={12} color="#fff" />
                  </TouchableOpacity>
                )}
              </Pressable>
            );
          })}

          {/* Partner avatar */}
          {isCohab && cohabData?.partner && (
            <View
              pointerEvents="none"
              style={[styles.avatarOnFloor, { left: partnerPos.x * roomSize.w - 40, top: partnerPos.y * roomSize.h - 60 }]}
            >
              <Avatar appearance={cohabData.partner.appearance} size={72} />
              <View style={styles.nameTagDark}>
                <Text style={styles.nameTagText} numberOfLines={1}>{cohabData.partner.name}</Text>
              </View>
            </View>
          )}

          {/* My avatar */}
          <View
            pointerEvents="none"
            style={[styles.avatarOnFloor, { left: avatarPos.x * roomSize.w - 40, top: avatarPos.y * roomSize.h - 60 }]}
          >
            <Avatar appearance={user?.appearance} size={72} />
            <View style={styles.nameTagDark}>
              <Text style={styles.nameTagText} numberOfLines={1}>{user?.name?.split(" ")[0] || "我"}</Text>
            </View>
          </View>

          {/* Joystick */}
          {!editMode && (
            <View style={styles.joystickWrap} pointerEvents="box-none">
              <Joystick size={92} onMove={onJoystickMove} onRelease={onJoystickRelease} />
            </View>
          )}

          {editMode && (
            <View style={styles.editHint}>
              <Text style={styles.editHintText}>
                {selectedId ? "點房間移動傢俱" : "點選傢俱再點房間"}
              </Text>
              <TouchableOpacity style={styles.addInline} onPress={() => setCatalogOpen(true)}>
                <Ionicons name="add" size={14} color={colors.bg} />
                <Text style={styles.addInlineText}>新增</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </View>

      {/* Bottom chat input pill */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.chatBar}>
          <TouchableOpacity
            style={styles.chatMini}
            testID="chat-mini-btn"
            onPress={() => isCohab ? router.push("/cohab-chat") : router.push("/(tabs)/chat")}
          >
            <View style={{ transform: [{ scale: 0.65 }] }}>
              <Avatar appearance={user?.appearance} size={40} />
            </View>
          </TouchableOpacity>
          <TextInput
            testID="house-chat-input"
            style={styles.chatInput}
            value={chatText}
            onChangeText={setChatText}
            placeholder={isCohab ? "說點什麼…" : "邀請朋友同居後就能聊天"}
            placeholderTextColor={colors.textSoft}
          />
          <TouchableOpacity testID="house-chat-send" style={styles.chatSend} onPress={sendMsg}>
            <Ionicons name="arrow-up" size={18} color={colors.bg} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Catalog Modal */}
      <Modal visible={catalogOpen} transparent animationType="slide" onRequestClose={() => setCatalogOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCatalogOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>選擇傢俱</Text>
            <ScrollView contentContainerStyle={styles.catalogGrid}>
              {catalog.map((c) => (
                <TouchableOpacity
                  key={c.catalog_id}
                  testID={`catalog-${c.catalog_id}`}
                  style={styles.catalogItem}
                  onPress={() => addItem(c.catalog_id)}
                >
                  <Text style={styles.catalogEmoji}>{c.emoji}</Text>
                  <Text style={styles.catalogName}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function RingSlot({
  label, sub, active, plus, dot, iconEmoji, avatar, onPress,
}: {
  label: string;
  sub?: string;
  active?: boolean;
  plus?: boolean;
  dot?: boolean;
  iconEmoji?: string;
  avatar?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={ringStyles.slot} onPress={onPress} activeOpacity={0.8}>
      <View style={[ringStyles.ring, active && ringStyles.ringActive, plus && ringStyles.ringPlus]}>
        {plus ? (
          <Text style={ringStyles.plusText}>+</Text>
        ) : avatar ? (
          <View style={{ overflow: "hidden", alignItems: "center", justifyContent: "flex-end", height: 50, width: 50 }}>
            {avatar}
          </View>
        ) : (
          <Text style={ringStyles.slotEmoji}>{iconEmoji}</Text>
        )}
      </View>
      <View style={ringStyles.labelRow}>
        {dot && <View style={ringStyles.dot} />}
        <Text style={ringStyles.label} numberOfLines={1}>{label}</Text>
      </View>
      {sub && <Text style={ringStyles.sub}>{sub}</Text>}
    </TouchableOpacity>
  );
}

const ringStyles = StyleSheet.create({
  slot: { width: 64, alignItems: "center", gap: 4 },
  ring: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceDarkSoft, borderWidth: 2, borderColor: colors.ringInactive, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  ringActive: { borderColor: colors.primary, borderWidth: 3 },
  ringPlus: { borderColor: colors.ringInactive, borderStyle: "dashed" },
  plusText: { color: colors.text, fontSize: 28, fontWeight: "300" },
  slotEmoji: { fontSize: 22 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  label: { color: colors.text, fontSize: 11, fontWeight: "700", maxWidth: 56 },
  sub: { color: colors.textSoft, fontSize: 10, fontWeight: "700" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  topGroup: { flexDirection: "row", backgroundColor: colors.surfaceDark, borderRadius: 999, padding: 4, gap: 0 },
  iconPill: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  nameBox: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  nameText: { color: colors.text, fontWeight: "900", fontSize: 16 },
  ringRow: { paddingHorizontal: 12, paddingBottom: 8, gap: 10, alignItems: "flex-start" },
  roomShell: { flex: 1, backgroundColor: colors.roomFloor, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", position: "relative" },
  statsBar: { flexDirection: "row", paddingHorizontal: 10, paddingTop: 10, paddingBottom: 6, gap: 6, flexWrap: "wrap" },
  statPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.18)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statEmoji: { fontSize: 12 },
  statText: { color: colors.textOnTan, fontWeight: "900", fontSize: 12 },
  tabRow: { paddingHorizontal: 10, paddingBottom: 4, gap: 6 },
  tabPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.18)", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  tabPillActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textOnTan, fontWeight: "900", fontSize: 12 },
  room: { flex: 1, position: "relative" },
  furniture: { position: "absolute", width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  furnitureSelected: { borderWidth: 2, borderColor: colors.primary, borderRadius: 8, transform: [{ scale: 1.1 }] },
  furnitureImg: { width: 44, height: 44 },
  furnitureEmoji: { fontSize: 30 },
  removeBtn: { position: "absolute", top: -8, right: -8, backgroundColor: colors.red, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  avatarOnFloor: { position: "absolute", alignItems: "center" },
  nameTagDark: { backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 2, maxWidth: 90 },
  nameTagText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  editHint: { position: "absolute", top: 10, left: 12, right: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  editHintText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  addInline: { flexDirection: "row", gap: 4, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignItems: "center" },
  addInlineText: { color: colors.bg, fontWeight: "900", fontSize: 12 },
  joystickWrap: { position: "absolute", left: 12, bottom: 12 },
  chatBar: { flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginTop: 8, marginBottom: 80, backgroundColor: colors.surfaceDark, borderRadius: 999, padding: 5, gap: 6 },
  chatMini: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  chatInput: { flex: 1, color: colors.text, fontSize: 14, paddingHorizontal: 8, paddingVertical: 6 },
  chatSend: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surfaceDark, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 20, maxHeight: "70%" },
  modalHandle: { width: 50, height: 5, backgroundColor: colors.ringInactive, borderRadius: 3, alignSelf: "center" },
  modalTitle: { fontSize: 22, fontWeight: "900", color: colors.text, marginTop: 16, marginBottom: 16 },
  catalogGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  catalogItem: { width: "30%", aspectRatio: 1, backgroundColor: colors.surfaceDarkSoft, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 6 },
  catalogEmoji: { fontSize: 36 },
  catalogName: { fontWeight: "700", fontSize: 12, color: colors.text },
});
