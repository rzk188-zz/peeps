import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, ASSETS } from "@/src/theme";

export default function FriendsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [cohabInvites, setCohabInvites] = useState<any[]>([]);
  const [cohab, setCohab] = useState<any>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [f, r, ci, cm] = await Promise.all([
        api.listFriends(),
        api.listRequests(),
        api.listCohabInvites(),
        api.cohabMe(),
      ]);
      setFriends(f);
      setRequests(r);
      setCohabInvites(ci);
      setCohab(cm.cohab ? cm : null);
    } catch (e: any) {
      console.warn(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addFriend = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await api.addFriend(code);
      if (r.status === "sent") Alert.alert("已送出邀請", "等待對方接受");
      else if (r.status === "accepted") Alert.alert("加為好友", `你和 ${r.user?.name} 已成為朋友`);
      else if (r.status === "already_friends") Alert.alert("已經是朋友囉");
      else if (r.status === "pending") Alert.alert("已送出過邀請");
      setCode("");
      load();
    } catch (e: any) {
      Alert.alert("失敗", e.message);
    } finally {
      setBusy(false);
    }
  };

  const accept = async (id: string) => { await api.acceptRequest(id); load(); };
  const reject = async (id: string) => { await api.rejectRequest(id); load(); };

  const inviteCohab = async (friend: any) => {
    Alert.alert(
      "邀請同居",
      `要邀請 ${friend.name} 跟你同居嗎？\n（你們會擁有一個共享的小屋）`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "邀請",
          onPress: async () => {
            try {
              const r = await api.inviteCohab(friend.user_id);
              if (r.status === "sent") Alert.alert("已送出同居邀請 💌");
              else if (r.status === "accepted") {
                Alert.alert("同居成立 💞", `你和 ${friend.name} 開始同居了！`);
                load();
              } else if (r.status === "pending") Alert.alert("已送出過邀請");
            } catch (e: any) {
              Alert.alert("失敗", e.message);
            }
          },
        },
      ]
    );
  };

  const acceptCohab = async (id: string, name: string) => {
    try {
      await api.acceptCohab(id);
      Alert.alert("同居成立 💞", `你和 ${name} 開始同居了！`);
      load();
    } catch (e: any) {
      Alert.alert("失敗", e.message);
    }
  };
  const rejectCohab = async (id: string) => { await api.rejectCohab(id); load(); };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const hasCohab = !!cohab?.cohab;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>朋友</Text>

      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>我的朋友代碼</Text>
        <Text testID="my-friend-code" style={styles.codeValue}>{user?.friend_code}</Text>
        <Text style={styles.codeHint}>分享給朋友來互相加好友</Text>
      </View>

      <View style={styles.addRow}>
        <TextInput
          testID="friend-code-input"
          style={styles.input}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="輸入朋友代碼"
          placeholderTextColor={colors.textSoft}
          autoCapitalize="characters"
          maxLength={6}
        />
        <TouchableOpacity
          testID="add-friend-btn"
          style={styles.addBtn}
          onPress={addFriend}
          disabled={busy || !code.trim()}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>加入</Text>}
        </TouchableOpacity>
      </View>

      <FlatList
        data={friends}
        keyExtractor={(it) => it.user_id}
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            {cohabInvites.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.section}>💞 同居邀請 ({cohabInvites.length})</Text>
                {cohabInvites.map((c) => (
                  <View key={c.invite_id} style={styles.cohabReq}>
                    <Image source={{ uri: c.from_user?.picture || ASSETS.avatarBoy }} style={styles.avatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{c.from_user?.name}</Text>
                      <Text style={styles.email}>想和你同居 💕</Text>
                    </View>
                    <TouchableOpacity
                      testID={`cohab-accept-${c.invite_id}`}
                      style={styles.accept}
                      onPress={() => acceptCohab(c.invite_id, c.from_user?.name)}
                    >
                      <Ionicons name="heart" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`cohab-reject-${c.invite_id}`}
                      style={styles.reject}
                      onPress={() => rejectCohab(c.invite_id)}
                    >
                      <Ionicons name="close" size={18} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {requests.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.section}>好友邀請 ({requests.length})</Text>
                {requests.map((r) => (
                  <View key={r.request_id} style={styles.reqRow}>
                    <Image source={{ uri: r.from_user?.picture || ASSETS.avatarBoy }} style={styles.avatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{r.from_user?.name}</Text>
                      <Text style={styles.email}>{r.from_user?.email}</Text>
                    </View>
                    <TouchableOpacity testID={`accept-${r.request_id}`} style={styles.accept} onPress={() => accept(r.request_id)}>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity testID={`reject-${r.request_id}`} style={styles.reject} onPress={() => reject(r.request_id)}>
                      <Ionicons name="close" size={18} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.section}>我的朋友 ({friends.length})</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👯</Text>
            <Text style={styles.emptyText}>還沒有朋友，用代碼加入吧！</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isPartner = hasCohab && (
            cohab.cohab.user_a === item.user_id || cohab.cohab.user_b === item.user_id
          );
          return (
            <View style={styles.friendRow}>
              <Image source={{ uri: item.picture || ASSETS.avatarGirl }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.name} {isPartner ? "💞" : ""}
                </Text>
                <Text style={styles.email} numberOfLines={1}>{item.friend_code}</Text>
              </View>
              {!isPartner && (
                <TouchableOpacity
                  testID={`cohab-invite-${item.user_id}`}
                  style={[styles.cohabBtn, hasCohab && { opacity: 0.4 }]}
                  onPress={() => !hasCohab && inviteCohab(item)}
                  disabled={hasCohab}
                >
                  <Ionicons name="heart" size={14} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                testID={`visit-${item.user_id}`}
                style={styles.visitBtn}
                onPress={() => router.push(`/house/${item.user_id}`)}
              >
                <Ionicons name="home" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                testID={`chat-${item.user_id}`}
                style={styles.chatBtn}
                onPress={() => router.push(`/chat/${item.user_id}`)}
              >
                <Ionicons name="chatbubble" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  title: { fontSize: 32, fontWeight: "900", color: colors.text, paddingHorizontal: 20, paddingVertical: 12 },
  codeCard: { marginHorizontal: 20, backgroundColor: colors.primary, padding: 20, borderRadius: 24, alignItems: "center" },
  codeLabel: { color: "#fff", fontWeight: "700", fontSize: 13, opacity: 0.9 },
  codeValue: { color: "#fff", fontSize: 36, fontWeight: "900", letterSpacing: 6, marginTop: 4 },
  codeHint: { color: "#fff", opacity: 0.8, fontSize: 12, marginTop: 4 },
  addRow: { flexDirection: "row", paddingHorizontal: 20, marginTop: 16, gap: 10 },
  input: { flex: 1, backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 14, fontSize: 16, fontWeight: "700", color: colors.text, borderWidth: 2, borderColor: colors.border },
  addBtn: { backgroundColor: colors.text, paddingHorizontal: 24, borderRadius: 999, justifyContent: "center" },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  section: { fontSize: 15, fontWeight: "800", color: colors.textSoft, marginTop: 20, marginBottom: 8 },
  friendRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", padding: 12, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  reqRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.yellow, padding: 12, borderRadius: 20, marginBottom: 8 },
  cohabReq: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.pink, padding: 12, borderRadius: 20, marginBottom: 8, borderWidth: 2, borderColor: colors.primary },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bg },
  name: { fontWeight: "800", color: colors.text, fontSize: 15 },
  email: { color: colors.textSoft, fontSize: 12, marginTop: 2 },
  accept: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  reject: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  cohabBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  visitBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  chatBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.pink, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: colors.textSoft, marginTop: 8, fontWeight: "600" },
});
