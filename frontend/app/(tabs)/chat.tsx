import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "@/src/lib/api";
import { colors, ASSETS } from "@/src/theme";

export default function ChatListScreen() {
  const router = useRouter();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setChats(await api.chatList());
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>聊天</Text>
      <FlatList
        data={chats}
        keyExtractor={(it) => it.friend.user_id}
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyText}>還沒有聊天，先加朋友吧！</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`chat-row-${item.friend.user_id}`}
            style={styles.row}
            onPress={() => router.push(`/chat/${item.friend.user_id}`)}
          >
            <Image source={{ uri: item.friend.picture || ASSETS.avatarGirl }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.friend.name}</Text>
              <Text style={styles.preview} numberOfLines={1}>
                {item.last_message?.text || "說聲嗨吧 👋"}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  title: { fontSize: 32, fontWeight: "900", color: colors.text, paddingHorizontal: 20, paddingVertical: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 24, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.bg },
  name: { fontWeight: "800", color: colors.text, fontSize: 16 },
  preview: { color: colors.textSoft, marginTop: 4, fontSize: 13 },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { color: colors.textSoft, marginTop: 10, fontWeight: "600" },
});
