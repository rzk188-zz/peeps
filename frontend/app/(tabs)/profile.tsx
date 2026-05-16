import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, ASSETS } from "@/src/theme";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [cohab, setCohab] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.cohabMe();
      setCohab(r.cohab ? r : null);
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onLogout = () => {
    Alert.alert("登出", "確定要登出嗎？", [
      { text: "取消", style: "cancel" },
      { text: "登出", style: "destructive", onPress: async () => {
        await signOut();
        router.replace("/");
      } },
    ]);
  };

  const onLeaveCohab = () => {
    Alert.alert("結束同居", `確定要和 ${cohab?.partner?.name} 結束同居嗎？\n共享小屋會被刪除`, [
      { text: "取消", style: "cancel" },
      { text: "結束", style: "destructive", onPress: async () => {
        await api.leaveCohab();
        setCohab(null);
        Alert.alert("已結束同居");
      } },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>我的</Text>
      <View style={styles.profileCard}>
        <Image source={{ uri: user?.picture || ASSETS.avatarGirl }} style={styles.avatar} />
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>朋友代碼</Text>
          <Text testID="profile-friend-code" style={styles.codeValue}>{user?.friend_code}</Text>
        </View>
      </View>

      {cohab?.partner && (
        <View style={styles.cohabCard}>
          <View style={styles.cohabHeader}>
            <Text style={styles.cohabBadge}>💞 同居中</Text>
          </View>
          <View style={styles.cohabRow}>
            <Image source={{ uri: user?.picture || ASSETS.avatarGirl }} style={styles.cohabAvatar} />
            <Text style={styles.cohabHeart}>♥</Text>
            <Image source={{ uri: cohab.partner.picture || ASSETS.avatarBoy }} style={styles.cohabAvatar} />
          </View>
          <Text style={styles.cohabNames}>{user?.name} & {cohab.partner.name}</Text>
          <Text style={styles.cohabHouseName}>{cohab.cohab.house_name}</Text>
          <TouchableOpacity
            testID="leave-cohab-btn"
            style={styles.leaveBtn}
            onPress={onLeaveCohab}
          >
            <Ionicons name="exit-outline" size={16} color="#E74C3C" />
            <Text style={styles.leaveText}>結束同居</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="settings-outline" size={22} color={colors.text} />
          <Text style={styles.menuText}>設定</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="help-circle-outline" size={22} color={colors.text} />
          <Text style={styles.menuText}>幫助與支援</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="logout-btn"
          style={[styles.menuItem, { backgroundColor: "#FFE6E6" }]}
          onPress={onLogout}
        >
          <Ionicons name="log-out-outline" size={22} color="#E74C3C" />
          <Text style={[styles.menuText, { color: "#E74C3C" }]}>登出</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 32, fontWeight: "900", color: colors.text, paddingHorizontal: 20, paddingVertical: 12 },
  profileCard: { alignItems: "center", paddingVertical: 20, marginHorizontal: 20, backgroundColor: "#fff", borderRadius: 28, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.bg },
  name: { fontSize: 22, fontWeight: "900", color: colors.text, marginTop: 12 },
  email: { color: colors.textSoft, marginTop: 4 },
  codeBox: { marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  codeLabel: { color: "#fff", fontSize: 11, fontWeight: "700" },
  codeValue: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: 4 },
  cohabCard: { marginTop: 16, marginHorizontal: 20, backgroundColor: colors.pink, padding: 18, borderRadius: 28, borderWidth: 2, borderColor: colors.primary, alignItems: "center" },
  cohabHeader: { marginBottom: 8 },
  cohabBadge: { fontSize: 14, fontWeight: "900", color: colors.primaryDark },
  cohabRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cohabAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff", borderWidth: 2, borderColor: "#fff" },
  cohabHeart: { fontSize: 26, color: colors.primary },
  cohabNames: { marginTop: 10, fontWeight: "900", color: colors.text },
  cohabHouseName: { color: colors.textSoft, fontSize: 12, marginTop: 2 },
  leaveBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, marginTop: 12 },
  leaveText: { color: "#E74C3C", fontWeight: "800", fontSize: 13 },
  menu: { marginTop: 20, marginHorizontal: 20, gap: 10, paddingBottom: 120 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#fff", padding: 18, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  menuText: { flex: 1, fontWeight: "700", fontSize: 15, color: colors.text },
});
