import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, ASSETS } from "@/src/theme";

export default function CohabChatRoom() {
  const { user } = useAuth();
  const router = useRouter();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [partner, setPartner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([api.cohabMe(), api.getCohabChat().catch(() => [])]);
      if (!c?.cohab) {
        Alert.alert("尚未同居", "請先在好友清單中邀請朋友同居");
        router.back();
        return;
      }
      setPartner(c.partner);
      setMsgs(m);
    } catch (e: any) {
      console.warn(e.message);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 4000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [msgs.length]);

  const send = async () => {
    if (!text.trim()) return;
    const t = text;
    setText("");
    try {
      const m = await api.sendCohabChat(t);
      setMsgs((prev) => [...prev, m]);
    } catch {
      setText(t);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.avatarPair}>
          <Image source={{ uri: user?.picture || ASSETS.avatarGirl }} style={styles.avatar} />
          <Image source={{ uri: partner?.picture || ASSETS.avatarBoy }} style={[styles.avatar, styles.avatarRight]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>同居小屋 💞</Text>
          <Text style={styles.status}>{partner?.name}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        <FlatList
          ref={listRef}
          data={msgs}
          keyExtractor={(it) => it.message_id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => {
            const mine = item.from_user_id === user?.user_id;
            return (
              <View style={[styles.bubble, mine ? styles.me : styles.them]}>
                <Text style={[styles.bubbleText, mine && { color: "#fff" }]}>{item.text}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💞</Text>
              <Text style={styles.emptyText}>說聲嗨開始你們的對話吧！</Text>
            </View>
          }
        />

        <View style={styles.inputBar}>
          <TextInput
            testID="cohab-chat-input"
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="跟室友說點什麼…"
            placeholderTextColor={colors.textSoft}
            multiline
          />
          <TouchableOpacity testID="cohab-send-btn" style={styles.send} onPress={send} disabled={!text.trim()}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { padding: 4 },
  avatarPair: { flexDirection: "row" },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bg, borderWidth: 2, borderColor: "#fff" },
  avatarRight: { marginLeft: -12 },
  name: { fontWeight: "900", color: colors.text, fontSize: 16 },
  status: { color: colors.textSoft, fontSize: 12, fontWeight: "600" },
  bubble: { padding: 12, borderRadius: 20, maxWidth: "78%" },
  me: { alignSelf: "flex-end", backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  them: { alignSelf: "flex-start", backgroundColor: "#fff", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  inputBar: { flexDirection: "row", gap: 10, padding: 12, alignItems: "flex-end", backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, backgroundColor: colors.bg, borderRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, maxHeight: 100, color: colors.text, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { color: colors.textSoft, marginTop: 10, fontWeight: "600" },
});
