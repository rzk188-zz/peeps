import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";
import { Avatar } from "@/src/components/Avatar";
import { colors, CHIBI_ASSETS } from "@/src/theme";
import {
  DEFAULT_APPEARANCE,
  Appearance,
  HAIR_OPTIONS,
  HAIR_COLORS,
  OUTFIT_OPTIONS,
} from "@/src/avatarOptions";

const TABS = [
  { id: "hair_style", label: "髮型", icon: "cut" as const },
  { id: "hair_color", label: "髮色", icon: "color-palette" as const },
  { id: "outfit", label: "服裝", icon: "shirt" as const },
];

export default function Customize() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const initial: Appearance = { ...DEFAULT_APPEARANCE, ...(user?.appearance || {}) };
  const [draft, setDraft] = useState<Appearance>(initial);
  const [tab, setTab] = useState("hair_style");
  const [busy, setBusy] = useState(false);

  const changed = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial]);

  const save = async () => {
    setBusy(true);
    try {
      const u = await api.updateAppearance(draft);
      setUser(u);
      Alert.alert("已儲存 ✨", "你的新外觀已套用");
    } catch (e: any) {
      Alert.alert("儲存失敗", e.message);
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>編輯外觀</Text>
        <TouchableOpacity
          testID="save-appearance"
          style={[styles.saveBtn, !changed && { opacity: 0.5 }]}
          onPress={save}
          disabled={!changed || busy}
        >
          <Text style={styles.saveText}>{busy ? "..." : "儲存"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.preview}>
        <View style={styles.previewCircle}>
          <Avatar appearance={draft} size={170} />
        </View>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            testID={`tab-${t.id}`}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            onPress={() => setTab(t.id)}
          >
            <Ionicons name={t.icon} size={18} color={tab === t.id ? "#fff" : colors.text} />
            <Text style={[styles.tabText, tab === t.id && { color: "#fff" }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {tab === "hair_style" && (
          <View style={styles.grid}>
            {HAIR_OPTIONS.map((h) => {
              const url = (CHIBI_ASSETS as any)[`hair_${h.id}`];
              const active = draft.hair_style === h.id;
              return (
                <TouchableOpacity
                  key={h.id}
                  testID={`hair-${h.id}`}
                  style={[styles.gridCard, active && styles.gridCardActive]}
                  onPress={() => setDraft({ ...draft, hair_style: h.id })}
                >
                  <Image
                    source={{ uri: url }}
                    style={{ width: 70, height: 70, tintColor: draft.hair_color }}
                    resizeMode="contain"
                  />
                  <Text style={styles.gridLabel}>{h.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {tab === "hair_color" && (
          <View style={styles.swatchRow}>
            {HAIR_COLORS.map((c) => {
              const active = c.toLowerCase() === draft.hair_color?.toLowerCase();
              return (
                <TouchableOpacity
                  key={c}
                  testID={`hair-color-${c.replace("#", "")}`}
                  style={[styles.swatch, { backgroundColor: c }, active && styles.swatchActive]}
                  onPress={() => setDraft({ ...draft, hair_color: c })}
                >
                  {active && <Ionicons name="checkmark" size={20} color="#fff" />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {tab === "outfit" && (
          <View style={styles.grid}>
            {OUTFIT_OPTIONS.map((o) => {
              const url = (CHIBI_ASSETS as any)[`outfit_${o.id}`];
              const active = draft.outfit === o.id;
              return (
                <TouchableOpacity
                  key={o.id}
                  testID={`outfit-${o.id}`}
                  style={[styles.gridCard, active && styles.gridCardActive]}
                  onPress={() => setDraft({ ...draft, outfit: o.id })}
                >
                  <Image source={{ uri: url }} style={{ width: 70, height: 70 }} resizeMode="contain" />
                  <Text style={styles.gridLabel}>{o.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { padding: 4 },
  title: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "900", color: colors.text },
  saveBtn: { backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999 },
  saveText: { color: "#fff", fontWeight: "900" },
  preview: { alignItems: "center", paddingVertical: 16 },
  previewCircle: { width: 220, height: 220, borderRadius: 110, backgroundColor: colors.pink, alignItems: "center", justifyContent: "flex-end", paddingBottom: 6, borderWidth: 4, borderColor: "#fff" },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  tab: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontWeight: "800", color: colors.text, fontSize: 13 },
  body: { paddingHorizontal: 20, paddingTop: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridCard: { width: "30%", aspectRatio: 1, backgroundColor: "#fff", borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 2, borderColor: colors.border },
  gridCardActive: { borderColor: colors.primary, backgroundColor: colors.pink },
  gridLabel: { fontWeight: "800", fontSize: 12, color: colors.text },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  swatch: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  swatchActive: { borderColor: colors.primary, transform: [{ scale: 1.1 }] },
});
