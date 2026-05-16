import React, { useEffect, useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { Appearance, DEFAULT_APPEARANCE } from "@/src/avatarOptions";
import { CHIBI_ASSETS } from "@/src/theme";

type Props = {
  appearance?: Partial<Appearance> | null;
  size?: number;
  walking?: boolean;
};

const FRAME_MS = 220;
const HAIR_KEYS = new Set(["short", "long", "twin", "bun", "beanie", "curly"]);
const OUTFIT_KEYS = new Set(["tee", "dress", "hoodie", "overalls", "pajamas", "sweater"]);

function normalize(a?: Partial<Appearance> | null): Appearance {
  const merged: Appearance = { ...DEFAULT_APPEARANCE, ...(a || {}) };
  // Migrate legacy shirt_style -> outfit
  if (!OUTFIT_KEYS.has(merged.outfit)) {
    const legacy = (a as any)?.shirt_style;
    merged.outfit = OUTFIT_KEYS.has(legacy) ? legacy : "tee";
  }
  if (!HAIR_KEYS.has(merged.hair_style)) merged.hair_style = "short";
  if (!merged.hair_color) merged.hair_color = DEFAULT_APPEARANCE.hair_color;
  return merged;
}

export function Avatar({ appearance, size = 100, walking = false }: Props) {
  const a = normalize(appearance);
  const [frame, setFrame] = useState<"idle" | "a" | "b">("idle");

  useEffect(() => {
    if (!walking) { setFrame("idle"); return; }
    let toggle = false;
    const id = setInterval(() => {
      toggle = !toggle;
      setFrame(toggle ? "a" : "b");
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [walking]);

  const bodyUrl =
    frame === "a" ? CHIBI_ASSETS.body_walk_a :
    frame === "b" ? CHIBI_ASSETS.body_walk_b :
    CHIBI_ASSETS.body_idle;
  const hairUrl = (CHIBI_ASSETS as any)[`hair_${a.hair_style}`];
  const outfitUrl = (CHIBI_ASSETS as any)[`outfit_${a.outfit}`];

  const W = size;
  const H = size * 1.25;

  return (
    <View style={{ width: W, height: H }} pointerEvents="none">
      <Image source={{ uri: bodyUrl }} style={[styles.layer, { width: W, height: H }]} resizeMode="contain" />
      {outfitUrl ? (
        <Image source={{ uri: outfitUrl }} style={[styles.layer, { width: W, height: H }]} resizeMode="contain" />
      ) : null}
      {hairUrl ? (
        <Image source={{ uri: hairUrl }} style={[styles.layer, { width: W, height: H, tintColor: a.hair_color }]} resizeMode="contain" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", top: 0, left: 0 },
});
