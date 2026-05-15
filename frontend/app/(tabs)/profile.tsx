import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { colors, ASSETS } from "@/src/theme";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const onLogout = () => {
    Alert.alert("登出", "確定要登出嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "登出",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/");
        },
      },
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
  menu: { marginTop: 20, marginHorizontal: 20, gap: 10 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#fff", padding: 18, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  menuText: { flex: 1, fontWeight: "700", fontSize: 15, color: colors.text },
});
