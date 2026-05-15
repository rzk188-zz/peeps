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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, ASSETS } from "@/src/theme";

export default function ChatRoom() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [other, setOther] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<any>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [m, friends] = await Promise.all([api.getChat(userId), api.listFriends()]);
      setMsgs(m);
      const f = friends.find((x: any) => x.user_id === userId);
      if (f) setOther(f);
    } catch {}
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 4000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [msgs.length]);

  const send = async () => {
    if (!text.trim() || !userId) return;
    const t = text;
    setText("");
    try {
      const m = await api.sendChat(userId, t);
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
        <Image source={{ uri: other?.picture || ASSETS.avatarGirl }} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{other?.name || "朋友"}</Text>
          <Text style={styles.status}>線上</Text>
        </View>
        <TouchableOpacity
          testID="visit-house-btn"
          style={styles.visitBtn}
          onPress={() => router.push(`/house/${userId}`)}
        >
          <Ionicons name="home" size={18} color="#fff" />
        </TouchableOpacity>
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
        />

        <View style={styles.inputBar}>
          <TextInput
            testID="chat-input"
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="輸入訊息…"
            placeholderTextColor={colors.textSoft}
            multiline
          />
          <TouchableOpacity testID="send-btn" style={styles.send} onPress={send} disabled={!text.trim()}>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { padding: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.bg },
  name: { fontWeight: "800", color: colors.text, fontSize: 16 },
  status: { color: colors.secondary, fontSize: 11, fontWeight: "700" },
  visitBtn: { backgroundColor: colors.accent, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  bubble: { padding: 12, borderRadius: 20, maxWidth: "78%" },
  me: { alignSelf: "flex-end", backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  them: { alignSelf: "flex-start", backgroundColor: "#fff", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  inputBar: { flexDirection: "row", gap: 10, padding: 12, alignItems: "flex-end", backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    color: colors.text,
    fontSize: 15,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
