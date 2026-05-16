import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, ASSETS, FURNITURE_EMOJI } from "@/src/theme";

type Item = { item_id: string; catalog_id: string; x: number; y: number };

export default function HouseScreen() {
  const { user } = useAuth();
  const router = useRouter();

  // mode: "solo" | "cohab"
  const [mode, setMode] = useState<"solo" | "cohab">("solo");
  const [cohabData, setCohabData] = useState<any>(null); // {cohab, partner}
  const [house, setHouse] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [avatarPos, setAvatarPos] = useState({ x: 0.5, y: 0.75 });
  const [partnerPos, setPartnerPos] = useState({ x: 0.65, y: 0.78 });
  const [editMode, setEditMode] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [roomSize, setRoomSize] = useState({ w: 0, h: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingAvatar, setDraggingAvatar] = useState(false);
  const [loading, setLoading] = useState(true);

  const isCohab = mode === "cohab" && !!cohabData?.cohab;

  const loadAll = useCallback(async () => {
    try {
      const [solo, c] = await Promise.all([api.getMyHouse(), api.cohabMe()]);
      setHouse(solo.house);
      if (c?.cohab) {
        setCohabData(c);
        // default to cohab view if exists
        setMode("cohab");
        applyCohab(c);
      } else {
        setCohabData(null);
        setMode("solo");
        setItems(solo.house.items || []);
        setAvatarPos({ x: solo.house.avatar_x ?? 0.5, y: solo.house.avatar_y ?? 0.75 });
      }
    } catch (e: any) {
      Alert.alert("錯誤", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyCohab = (c: any) => {
    setItems(c.cohab.items || []);
    const isA = c.cohab.user_a === user?.user_id;
    setAvatarPos({
      x: isA ? c.cohab.avatar_a_x ?? 0.35 : c.cohab.avatar_b_x ?? 0.65,
      y: isA ? c.cohab.avatar_a_y ?? 0.78 : c.cohab.avatar_b_y ?? 0.78,
    });
    setPartnerPos({
      x: isA ? c.cohab.avatar_b_x ?? 0.65 : c.cohab.avatar_a_x ?? 0.35,
      y: isA ? c.cohab.avatar_b_y ?? 0.78 : c.cohab.avatar_a_y ?? 0.78,
    });
  };

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  useEffect(() => {
    api.catalog().then(setCatalog).catch(() => {});
  }, []);

  const switchMode = (m: "solo" | "cohab") => {
    setMode(m);
    setSelectedId(null);
    setEditMode(false);
    if (m === "solo" && house) {
      setItems(house.items || []);
      setAvatarPos({ x: house.avatar_x ?? 0.5, y: house.avatar_y ?? 0.75 });
    } else if (m === "cohab" && cohabData) {
      applyCohab(cohabData);
    }
  };

  const persist = async (nextItems: Item[], nextAvatar?: { x: number; y: number }) => {
    const ax = (nextAvatar || avatarPos).x;
    const ay = (nextAvatar || avatarPos).y;
    try {
      if (isCohab) {
        const r = await api.updateCohab({ items: nextItems, avatar_x: ax, avatar_y: ay });
        setCohabData(r);
        applyCohab(r);
      } else {
        await api.updateMyHouse({ items: nextItems, avatar_x: ax, avatar_y: ay });
      }
    } catch (e: any) {
      Alert.alert("儲存失敗", e.message);
    }
  };

  const onRoomPress = (e: any) => {
    if (!editMode) return;
    const { locationX, locationY } = e.nativeEvent;
    const x = Math.max(0.05, Math.min(0.95, locationX / roomSize.w));
    const y = Math.max(0.3, Math.min(0.92, locationY / roomSize.h));

    if (draggingAvatar) {
      const next = { x, y };
      setAvatarPos(next);
      setDraggingAvatar(false);
      persist(items, next);
      return;
    }
    if (selectedId) {
      const next = items.map((it) => (it.item_id === selectedId ? { ...it, x, y } : it));
      setItems(next);
      persist(next);
    }
  };

  const addItem = (catalog_id: string) => {
    const newItem: Item = {
      item_id: `${catalog_id}_${Date.now()}`,
      catalog_id,
      x: 0.5,
      y: 0.6,
    };
    const next = [...items, newItem];
    setItems(next);
    setSelectedId(newItem.item_id);
    setCatalogOpen(false);
    persist(next);
  };

  const removeItem = (id: string) => {
    const next = items.filter((it) => it.item_id !== id);
    setItems(next);
    setSelectedId(null);
    persist(next);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const houseName = isCohab ? cohabData?.cohab?.house_name : house?.house_name;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>嗨，{user?.name?.split(" ")[0] || "你"} 👋</Text>
          <Text style={styles.houseTitle} numberOfLines={1}>
            {houseName || "我的小屋"} {isCohab ? "💞" : ""}
          </Text>
        </View>
        <TouchableOpacity
          testID="edit-mode-toggle"
          style={[styles.editBtn, editMode && styles.editBtnActive]}
          onPress={() => {
            setEditMode((v) => !v);
            setSelectedId(null);
            setDraggingAvatar(false);
          }}
        >
          <Ionicons name={editMode ? "checkmark" : "create-outline"} size={20} color={editMode ? "#fff" : colors.text} />
          <Text style={[styles.editBtnText, editMode && { color: "#fff" }]}>
            {editMode ? "完成" : "佈置"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mode switcher (only if cohab exists) */}
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
          <ImageBackground source={{ uri: ASSETS.roomBg }} style={styles.bg} resizeMode="cover">
            {items.map((it) => {
              const isSelected = selectedId === it.item_id;
              return (
                <Pressable
                  key={it.item_id}
                  testID={`furniture-${it.catalog_id}`}
                  style={[
                    styles.furniture,
                    { left: it.x * roomSize.w - 30, top: it.y * roomSize.h - 30 },
                    isSelected && styles.furnitureSelected,
                  ]}
                  onPress={(e) => { e.stopPropagation?.(); if (editMode) { setSelectedId(it.item_id); setDraggingAvatar(false); } }}
                >
                  <Text style={styles.furnitureEmoji}>{FURNITURE_EMOJI[it.catalog_id] || "📦"}</Text>
                  {isSelected && editMode && (
                    <TouchableOpacity testID="remove-furniture" style={styles.removeBtn} onPress={() => removeItem(it.item_id)}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </Pressable>
              );
            })}

            {/* Partner avatar (cohab only) */}
            {isCohab && cohabData?.partner && (
              <View
                pointerEvents="none"
                style={[
                  styles.avatarOnFloor,
                  { left: partnerPos.x * roomSize.w - 50, top: partnerPos.y * roomSize.h - 80 },
                ]}
              >
                <Image source={{ uri: ASSETS.avatarBoy }} style={styles.avatarImg} />
                <View style={[styles.nameTag, { backgroundColor: colors.accent }]}>
                  <Text style={styles.nameTagText} numberOfLines={1}>{cohabData.partner.name}</Text>
                </View>
              </View>
            )}

            {/* My avatar */}
            <Pressable
              testID="my-avatar"
              style={[
                styles.avatarOnFloor,
                { left: avatarPos.x * roomSize.w - 50, top: avatarPos.y * roomSize.h - 80 },
                draggingAvatar && { opacity: 0.5 },
              ]}
              onPress={(e) => {
                e.stopPropagation?.();
                if (editMode) {
                  setDraggingAvatar(true);
                  setSelectedId(null);
                }
              }}
            >
              <Image source={{ uri: ASSETS.avatarGirl }} style={styles.avatarImg} />
              <View style={styles.nameTag}>
                <Text style={styles.nameTagText} numberOfLines={1}>{user?.name || "我"}</Text>
              </View>
            </Pressable>
          </ImageBackground>
        </Pressable>

        {editMode && (
          <View style={styles.editHint}>
            <Text style={styles.editHintText}>
              {draggingAvatar
                ? "點房間任意處放置你的角色"
                : selectedId
                ? "點房間移動傢俱，或點角色移動位置"
                : "點選傢俱或角色，再點房間放置"}
            </Text>
          </View>
        )}

        {/* Cohab chat floating button */}
        {isCohab && !editMode && (
          <TouchableOpacity
            testID="cohab-chat-fab"
            style={styles.fab}
            onPress={() => router.push("/cohab-chat")}
          >
            <Ionicons name="chatbubbles" size={22} color="#fff" />
            <Text style={styles.fabText}>同居聊天</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          testID="add-furniture-btn"
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={() => setCatalogOpen(true)}
        >
          <Ionicons name="add-circle" size={22} color="#fff" />
          <Text style={styles.actionText}>新增傢俱</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="visit-friends-btn"
          style={[styles.actionBtn, { backgroundColor: colors.accent }]}
          onPress={() => router.push("/(tabs)/friends")}
        >
          <Ionicons name="people" size={22} color="#fff" />
          <Text style={styles.actionText}>朋友</Text>
        </TouchableOpacity>
      </View>

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
  room: { flex: 1, borderRadius: 32, overflow: "hidden", backgroundColor: "#FFE9D6" },
  bg: { flex: 1, position: "relative" },
  furniture: { position: "absolute", width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.85)", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  furnitureSelected: { borderWidth: 3, borderColor: colors.primary, transform: [{ scale: 1.1 }] },
  furnitureEmoji: { fontSize: 34 },
  removeBtn: { position: "absolute", top: -8, right: -8, backgroundColor: "#E74C3C", width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  avatarOnFloor: { position: "absolute", alignItems: "center" },
  avatarImg: { width: 100, height: 130, resizeMode: "contain" },
  nameTag: { backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: -8, maxWidth: 100 },
  nameTagText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  editHint: { position: "absolute", top: 16, left: 32, right: 32, backgroundColor: "rgba(45,52,54,0.85)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 },
  editHintText: { color: "#fff", fontWeight: "700", textAlign: "center", fontSize: 13 },
  fab: { position: "absolute", right: 28, bottom: 18, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 },
  fabText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  actions: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 20 },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 20, maxHeight: "70%" },
  modalHandle: { width: 50, height: 5, backgroundColor: colors.border, borderRadius: 3, alignSelf: "center" },
  modalTitle: { fontSize: 22, fontWeight: "900", color: colors.text, marginTop: 16, marginBottom: 16 },
  catalogGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  catalogItem: { width: "30%", aspectRatio: 1, backgroundColor: colors.bg, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 2, borderColor: colors.border },
  catalogEmoji: { fontSize: 38 },
  catalogName: { fontWeight: "700", fontSize: 12, color: colors.text },
});
