import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { colors, ASSETS, FURNITURE_EMOJI } from "@/src/theme";

export default function VisitHouse() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    api
      .getHouse(userId)
      .then(setData)
      .catch((e: any) => Alert.alert("錯誤", e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text>找不到小屋</Text>
      </View>
    );
  }

  const { house, owner } = data;
  const items = house.items || [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{owner?.name} 的小屋</Text>
          <Text style={styles.subtitle}>{house.house_name}</Text>
        </View>
        <TouchableOpacity
          testID="chat-with-owner"
          style={styles.chatBtn}
          onPress={() => router.replace(`/chat/${userId}`)}
        >
          <Ionicons name="chatbubble" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.roomWrap}>
        <View
          style={styles.room}
          onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          <ImageBackground source={{ uri: ASSETS.roomBg }} style={styles.bg} resizeMode="cover">
            {items.map((it: any) => (
              <View
                key={it.item_id}
                style={[
                  styles.furniture,
                  { left: it.x * size.w - 30, top: it.y * size.h - 30 },
                ]}
              >
                <Text style={styles.furnitureEmoji}>{FURNITURE_EMOJI[it.catalog_id] || "📦"}</Text>
              </View>
            ))}
            <View
              style={[
                styles.avatarOnFloor,
                {
                  left: (house.avatar_x || 0.5) * size.w - 50,
                  top: (house.avatar_y || 0.75) * size.h - 80,
                },
              ]}
            >
              <Image source={{ uri: ASSETS.avatarBoy }} style={styles.avatarImg} />
              <View style={styles.nameTag}>
                <Text style={styles.nameTagText} numberOfLines={1}>{owner?.name}</Text>
              </View>
            </View>
          </ImageBackground>
        </View>
      </View>

      <View style={styles.bottomBar}>
        <Text style={styles.tip}>✨ 你正在拜訪朋友的小屋</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  iconBtn: { padding: 4 },
  title: { fontWeight: "900", color: colors.text, fontSize: 18 },
  subtitle: { color: colors.textSoft, fontSize: 12 },
  chatBtn: { backgroundColor: colors.primary, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  roomWrap: { flex: 1, paddingHorizontal: 16 },
  room: { flex: 1, borderRadius: 32, overflow: "hidden", backgroundColor: "#FFE9D6" },
  bg: { flex: 1, position: "relative" },
  furniture: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  furnitureEmoji: { fontSize: 34 },
  avatarOnFloor: { position: "absolute", alignItems: "center" },
  avatarImg: { width: 100, height: 130, resizeMode: "contain" },
  nameTag: { backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: -8 },
  nameTagText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  bottomBar: { padding: 16, alignItems: "center" },
  tip: { color: colors.textSoft, fontWeight: "700" },
});
