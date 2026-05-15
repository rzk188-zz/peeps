import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useAuth } from "@/src/context/AuthContext";
import { colors, ASSETS } from "@/src/theme";

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const { user, loading, signInWithSessionToken } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Redirect to tabs once authenticated
  useEffect(() => {
    if (!loading && user) {
      router.replace("/(tabs)");
    }
  }, [user, loading, router]);

  // Web: parse session_id from URL on mount
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const search = typeof window !== "undefined" ? window.location.search : "";
    let sid: string | null = null;
    if (hash.includes("session_id=")) {
      sid = new URLSearchParams(hash.replace(/^#/, "")).get("session_id");
    } else if (search.includes("session_id=")) {
      sid = new URLSearchParams(search).get("session_id");
    }
    if (sid) {
      setBusy(true);
      signInWithSessionToken(sid)
        .then(() => {
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", window.location.pathname);
          }
        })
        .catch((e: any) => Alert.alert("登入失敗", e.message))
        .finally(() => setBusy(false));
    }
  }, [signInWithSessionToken]);

  // Mobile: cold-start deep link
  useEffect(() => {
    if (Platform.OS === "web") return;
    const handle = (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      const sid =
        (parsed.queryParams?.session_id as string | undefined) ||
        (() => {
          const m = url.match(/session_id=([^&#]+)/);
          return m ? decodeURIComponent(m[1]) : undefined;
        })();
      if (sid) {
        setBusy(true);
        signInWithSessionToken(sid)
          .catch((e: any) => Alert.alert("登入失敗", e.message))
          .finally(() => setBusy(false));
      }
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener("url", (e) => handle(e.url));
    return () => sub.remove();
  }, [signInWithSessionToken]);

  const onLogin = async () => {
    setBusy(true);
    try {
      let redirectUrl: string;
      if (Platform.OS === "web") {
        redirectUrl = window.location.origin + "/";
      } else {
        redirectUrl = Linking.createURL("auth");
      }
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === "web") {
        window.location.href = authUrl;
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === "success" && result.url) {
        const m = result.url.match(/session_id=([^&#]+)/);
        if (m) {
          await signInWithSessionToken(decodeURIComponent(m[1]));
        }
      }
    } catch (e: any) {
      Alert.alert("登入失敗", e.message || "請再試一次");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="login-screen">
      <View style={styles.heroWrap}>
        <View style={[styles.blob, styles.blobPink]} />
        <View style={[styles.blob, styles.blobBlue]} />
        <View style={[styles.blob, styles.blobMint]} />
        <View style={styles.avatarsRow}>
          <Image source={{ uri: ASSETS.avatarGirl }} style={styles.heroAvatar} />
          <Image source={{ uri: ASSETS.avatarBoy }} style={[styles.heroAvatar, styles.heroAvatarBack]} />
        </View>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.title}>Peeps</Text>
        <Text style={styles.subtitle}>和朋友一起{"\n"}打造你們的小屋 🏠</Text>

        <TouchableOpacity
          testID="google-login-button"
          style={styles.googleBtn}
          onPress={onLogin}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleText}>使用 Google 登入</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.footer}>登入即代表同意服務條款</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  heroWrap: { flex: 1.1, position: "relative", overflow: "hidden" },
  blob: { position: "absolute", borderRadius: 999, opacity: 0.7 },
  blobPink: { width: 280, height: 280, backgroundColor: colors.pink, top: -60, left: -60 },
  blobBlue: { width: 220, height: 220, backgroundColor: colors.accent, top: 80, right: -50, opacity: 0.5 },
  blobMint: { width: 200, height: 200, backgroundColor: colors.secondary, bottom: -30, left: 30, opacity: 0.5 },
  avatarsRow: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: -30,
  },
  heroAvatar: { width: 180, height: 220, resizeMode: "contain" },
  heroAvatarBack: { width: 160, height: 200, marginLeft: -30 },
  bottom: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 48,
    alignItems: "center",
  },
  title: { fontSize: 56, fontWeight: "900", color: colors.text, letterSpacing: -1 },
  subtitle: {
    fontSize: 18,
    color: colors.textSoft,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 26,
    fontWeight: "600",
  },
  googleBtn: {
    marginTop: 36,
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 36,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
    minWidth: 260,
    justifyContent: "center",
  },
  googleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    color: "#EA4335",
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 28,
    fontSize: 18,
  },
  googleText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  footer: { marginTop: 20, color: colors.textSoft, fontSize: 12 },
});
