import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";
import { Avatar } from "@/src/components/Avatar";
import { colors } from "@/src/theme";
import {
  DEFAULT_APPEARANCE,
  Appearance,
  SKIN_OPTIONS,
  EYE_STYLES,
  EYE_COLORS,
  HAIR_STYLES,
  HAIR_COLORS,
  SHIRT_STYLES,
  SHIRT_COLORS,
  PANTS_COLORS,
} from "@/src/avatarOptions";

const CATEGORIES = [
  { id: "skin", label: "膚色", icon: "color-palette" as const },
  { id: "eyes", label: "眼睛", icon: "eye" as const },
  { id: "hair", label: "髮型", icon: "cut" as const },
  { id: "shirt", label: "上衣", icon: "shirt" as const },
  { id: "pants", label: "褲子", icon: "walk" as const },
];

export default function Customize() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const initial: Appearance = { ...DEFAULT_APPEARANCE, ...(user?.appearance || {}) };
  const [draft, setDraft] = useState<Appearance>(initial);
  const [tab, setTab] = useState("skin");
  const [busy, setBusy] = useState(false);

  const changed = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial]
  );

  const update = (patch: Partial<Appearance>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      const u = await api.updateAppearance(draft);
      setUser(u);
      Alert.alert("已儲存 ✨", "你的新外觀已套用");
    } catch (e: any) {
      Alert.alert("儲存失敗", e.message);
    } finally {
      setBusy(false);
    }
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
          <Text style={styles.saveText}>{busy ? "儲存中..." : "儲存"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.preview}>
        <View style={styles.previewCircle}>
          <Avatar appearance={draft} size={170} />
        </View>
      </View>

      <View style={styles.tabs}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.id}
            testID={`tab-${c.id}`}
            style={[styles.tab, tab === c.id && styles.tabActive]}
            onPress={() => setTab(c.id)}
          >
            <Ionicons name={c.icon} size={18} color={tab === c.id ? "#fff" : colors.text} />
            <Text style={[styles.tabText, tab === c.id && { color: "#fff" }]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {tab === "skin" && (
          <Section title="膚色">
            <SwatchRow
              colors={SKIN_OPTIONS}
              selected={draft.skin}
              onSelect={(c) => update({ skin: c })}
              testPrefix="skin"
            />
          </Section>
        )}

        {tab === "eyes" && (
          <>
            <Section title="眼睛樣式">
              <View style={styles.styleGrid}>
                {EYE_STYLES.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    testID={`eye-style-${s.id}`}
                    style={[styles.stylePill, draft.eyes === s.id && styles.stylePillActive]}
                    onPress={() => update({ eyes: s.id })}
                  >
                    <Text style={[styles.styleText, draft.eyes === s.id && { color: "#fff" }]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>
            <Section title="眼睛顏色">
              <SwatchRow
                colors={EYE_COLORS}
                selected={draft.eye_color}
                onSelect={(c) => update({ eye_color: c })}
                testPrefix="eye-color"
              />
            </Section>
          </>
        )}

        {tab === "hair" && (
          <>
            <Section title="髮型">
              <View style={styles.styleGrid}>
                {HAIR_STYLES.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    testID={`hair-style-${s.id}`}
                    style={[styles.stylePill, draft.hair_style === s.id && styles.stylePillActive]}
                    onPress={() => update({ hair_style: s.id })}
                  >
                    <Text style={[styles.styleText, draft.hair_style === s.id && { color: "#fff" }]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>
            <Section title="髮色">
              <SwatchRow
                colors={HAIR_COLORS}
                selected={draft.hair_color}
                onSelect={(c) => update({ hair_color: c })}
                testPrefix="hair-color"
              />
            </Section>
          </>
        )}

        {tab === "shirt" && (
          <>
            <Section title="上衣樣式">
              <View style={styles.styleGrid}>
                {SHIRT_STYLES.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    testID={`shirt-style-${s.id}`}
                    style={[styles.stylePill, draft.shirt_style === s.id && styles.stylePillActive]}
                    onPress={() => update({ shirt_style: s.id })}
                  >
                    <Text style={[styles.styleText, draft.shirt_style === s.id && { color: "#fff" }]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>
            <Section title="上衣顏色">
              <SwatchRow
                colors={SHIRT_COLORS}
                selected={draft.shirt_color}
                onSelect={(c) => update({ shirt_color: c })}
                testPrefix="shirt-color"
              />
            </Section>
          </>
        )}

        {tab === "pants" && (
          <Section title="褲子顏色">
            <SwatchRow
              colors={PANTS_COLORS}
              selected={draft.pants_color}
              onSelect={(c) => update({ pants_color: c })}
              testPrefix="pants-color"
            />
          </Section>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SwatchRow({
  colors: list,
  selected,
  onSelect,
  testPrefix,
}: {
  colors: string[];
  selected: string;
  onSelect: (c: string) => void;
  testPrefix: string;
}) {
  return (
    <View style={styles.swatchRow}>
      {list.map((c) => {
        const active = c.toLowerCase() === selected?.toLowerCase();
        return (
          <TouchableOpacity
            key={c}
            testID={`${testPrefix}-${c.replace("#", "")}`}
            style={[styles.swatch, { backgroundColor: c }, active && styles.swatchActive]}
            onPress={() => onSelect(c)}
          >
            {active && <Ionicons name="checkmark" size={18} color="#fff" />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { padding: 4 },
  title: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "900", color: colors.text },
  saveBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  saveText: { color: "#fff", fontWeight: "900" },
  preview: { alignItems: "center", paddingVertical: 16 },
  previewCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 6,
    borderWidth: 4,
    borderColor: "#fff",
  },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  tab: { flex: 1, flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontWeight: "800", color: colors.text, fontSize: 12 },
  body: { paddingHorizontal: 20, paddingTop: 8 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.textSoft, marginBottom: 8 },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  swatchActive: { borderColor: colors.primary, transform: [{ scale: 1.08 }] },
  styleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stylePill: { backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  stylePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  styleText: { fontWeight: "800", color: colors.text, fontSize: 13 },
});
