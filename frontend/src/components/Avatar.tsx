import React from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Ellipse,
  Path,
  Rect,
  G,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { Appearance, DEFAULT_APPEARANCE } from "@/src/avatarOptions";

type Props = {
  appearance?: Partial<Appearance> | null;
  size?: number;
  showShadow?: boolean;
};

function mergeAppearance(a?: Partial<Appearance> | null): Appearance {
  return { ...DEFAULT_APPEARANCE, ...(a || {}) };
}

// ViewBox: 100x140  (head 0..70, body 60..140)
export function Avatar({ appearance, size = 120, showShadow = true }: Props) {
  const a = mergeAppearance(appearance);
  const W = size;
  const H = size * 1.4;
  const id = `av-${Math.round(Math.random() * 1e6)}`;

  return (
    <View pointerEvents="none" style={{ width: W, height: H }}>
      <Svg width={W} height={H} viewBox="0 0 100 140">
        <Defs>
          <LinearGradient id={`shirtg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={a.shirt_color} stopOpacity="1" />
            <Stop offset="1" stopColor={a.shirt_color} stopOpacity="0.85" />
          </LinearGradient>
        </Defs>

        {/* Shadow */}
        {showShadow && (
          <Ellipse cx="50" cy="135" rx="22" ry="3.5" fill="rgba(0,0,0,0.18)" />
        )}

        {/* --- BODY --- */}
        {/* legs (pants) */}
        <Rect x="34" y="105" width="13" height="22" rx="3" fill={a.pants_color} />
        <Rect x="53" y="105" width="13" height="22" rx="3" fill={a.pants_color} />
        {/* shoes */}
        <Ellipse cx="40.5" cy="129" rx="8" ry="3.5" fill="#2D3436" />
        <Ellipse cx="59.5" cy="129" rx="8" ry="3.5" fill="#2D3436" />

        {/* arms */}
        <Rect x="20" y="78" width="10" height="28" rx="5" fill={a.skin} />
        <Rect x="70" y="78" width="10" height="28" rx="5" fill={a.skin} />

        {/* shirt */}
        <ShirtShape style={a.shirt_style} color={a.shirt_color} skin={a.skin} gradId={`shirtg-${id}`} />

        {/* neck */}
        <Rect x="45" y="68" width="10" height="8" fill={a.skin} />

        {/* --- HEAD --- */}
        {/* hair back layer (for long/ponytail/twin) */}
        <HairBack style={a.hair_style} color={a.hair_color} />

        {/* face */}
        <Ellipse cx="50" cy="40" rx="22" ry="24" fill={a.skin} />

        {/* ears */}
        <Ellipse cx="28" cy="44" rx="4" ry="6" fill={a.skin} />
        <Ellipse cx="72" cy="44" rx="4" ry="6" fill={a.skin} />

        {/* cheeks (blush) */}
        <Ellipse cx="36" cy="48" rx="4" ry="2.5" fill="#FFB5B5" opacity="0.7" />
        <Ellipse cx="64" cy="48" rx="4" ry="2.5" fill="#FFB5B5" opacity="0.7" />

        {/* eyes */}
        <Eyes style={a.eyes} color={a.eye_color} />

        {/* mouth */}
        <Path
          d="M44 53 Q50 58 56 53"
          stroke="#5A3A2A"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />

        {/* hair front */}
        <HairFront style={a.hair_style} color={a.hair_color} />
      </Svg>
    </View>
  );
}

function Eyes({ style, color }: { style: string; color: string }) {
  switch (style) {
    case "sparkle":
      return (
        <G>
          <Circle cx="40" cy="40" r="3.5" fill={color} />
          <Circle cx="60" cy="40" r="3.5" fill={color} />
          <Circle cx="41" cy="39" r="1" fill="#fff" />
          <Circle cx="61" cy="39" r="1" fill="#fff" />
          <Path d="M40 35 L40.6 33 L41 35 L43 35.4 L41 35.8 L40.5 37.7 L40 35.8 L38 35.4 Z" fill="#fff" />
        </G>
      );
    case "sleepy":
      return (
        <G stroke={color} strokeWidth="2" strokeLinecap="round" fill="none">
          <Path d="M36 41 Q40 38 44 41" />
          <Path d="M56 41 Q60 38 64 41" />
        </G>
      );
    case "cat":
      return (
        <G>
          <Path d="M36 42 Q40 36 44 42" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <Path d="M56 42 Q60 36 64 42" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </G>
      );
    case "dot":
      return (
        <G fill={color}>
          <Circle cx="40" cy="40" r="2" />
          <Circle cx="60" cy="40" r="2" />
        </G>
      );
    case "wink":
      return (
        <G>
          <Circle cx="40" cy="40" r="3" fill={color} />
          <Circle cx="40.7" cy="39.3" r="0.9" fill="#fff" />
          <Path d="M56 40 Q60 37 64 40" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
        </G>
      );
    case "round":
    default:
      return (
        <G>
          <Circle cx="40" cy="40" r="3" fill={color} />
          <Circle cx="60" cy="40" r="3" fill={color} />
          <Circle cx="40.8" cy="39.2" r="0.9" fill="#fff" />
          <Circle cx="60.8" cy="39.2" r="0.9" fill="#fff" />
        </G>
      );
  }
}

function HairBack({ style, color }: { style: string; color: string }) {
  switch (style) {
    case "long":
      return <Path d="M28 38 Q28 80 50 84 Q72 80 72 38 Z" fill={color} />;
    case "ponytail":
      return <Ellipse cx="76" cy="48" rx="6" ry="14" fill={color} />;
    case "twin":
      return (
        <G fill={color}>
          <Ellipse cx="24" cy="52" rx="5" ry="14" />
          <Ellipse cx="76" cy="52" rx="5" ry="14" />
        </G>
      );
    case "bun":
      return <Circle cx="50" cy="14" r="8" fill={color} />;
    default:
      return null;
  }
}

function HairFront({ style, color }: { style: string; color: string }) {
  switch (style) {
    case "short":
      return (
        <Path
          d="M28 38 Q30 18 50 16 Q70 18 72 38 Q66 32 56 33 Q50 28 44 33 Q34 32 28 38 Z"
          fill={color}
        />
      );
    case "bob":
      return (
        <Path
          d="M26 40 Q26 18 50 16 Q74 18 74 40 Q72 50 70 50 Q70 36 50 32 Q30 36 30 50 Q28 50 26 40 Z"
          fill={color}
        />
      );
    case "long":
      return (
        <Path
          d="M28 38 Q30 16 50 14 Q70 16 72 38 Q64 30 50 30 Q36 30 28 38 Z"
          fill={color}
        />
      );
    case "ponytail":
      return (
        <Path
          d="M28 38 Q30 18 50 16 Q70 18 72 38 Q60 30 48 32 Q36 32 28 38 Z"
          fill={color}
        />
      );
    case "twin":
      return (
        <Path
          d="M28 38 Q30 18 50 16 Q70 18 72 38 Q60 30 50 32 Q40 30 28 38 Z"
          fill={color}
        />
      );
    case "bun":
      return (
        <Path
          d="M28 38 Q30 22 50 22 Q70 22 72 38 Q60 30 50 32 Q40 30 28 38 Z"
          fill={color}
        />
      );
    case "curly":
      return (
        <G fill={color}>
          <Circle cx="34" cy="24" r="8" />
          <Circle cx="46" cy="18" r="8" />
          <Circle cx="58" cy="18" r="8" />
          <Circle cx="68" cy="26" r="8" />
          <Circle cx="30" cy="34" r="7" />
          <Circle cx="70" cy="34" r="7" />
        </G>
      );
    case "beanie":
      return (
        <G>
          <Path d="M26 32 Q30 12 50 12 Q70 12 74 32 L74 36 L26 36 Z" fill={color} />
          <Rect x="26" y="34" width="48" height="6" rx="3" fill="#fff" opacity="0.4" />
          <Circle cx="50" cy="10" r="4" fill="#fff" opacity="0.8" />
        </G>
      );
    case "bald":
    default:
      return null;
  }
}

function ShirtShape({
  style,
  color,
  skin,
  gradId,
}: {
  style: string;
  color: string;
  skin: string;
  gradId: string;
}) {
  const fill = `url(#${gradId})`;
  switch (style) {
    case "hoodie":
      return (
        <G>
          <Path d="M28 76 Q50 70 72 76 L78 108 L22 108 Z" fill={fill} />
          <Path d="M40 70 Q50 64 60 70 Q60 80 50 80 Q40 80 40 70 Z" fill={color} />
        </G>
      );
    case "stripe":
      return (
        <G>
          <Path d="M28 76 L72 76 L78 108 L22 108 Z" fill={fill} />
          <Rect x="22" y="82" width="56" height="3" fill="#fff" opacity="0.6" />
          <Rect x="22" y="92" width="56" height="3" fill="#fff" opacity="0.6" />
          <Rect x="22" y="102" width="56" height="3" fill="#fff" opacity="0.6" />
        </G>
      );
    case "dress":
      return (
        <Path d="M28 76 L72 76 L86 116 L14 116 Z" fill={fill} />
      );
    case "overalls":
      return (
        <G>
          <Rect x="22" y="92" width="56" height="18" fill={fill} />
          <Rect x="34" y="76" width="8" height="22" fill={fill} />
          <Rect x="58" y="76" width="8" height="22" fill={fill} />
          <Circle cx="38" cy="96" r="1.5" fill="#FFE5A0" />
          <Circle cx="62" cy="96" r="1.5" fill="#FFE5A0" />
        </G>
      );
    case "sweater":
      return (
        <Path d="M22 76 Q50 72 78 76 L80 110 L20 110 Z" fill={fill} />
      );
    case "tee":
    default:
      return <Path d="M28 76 L72 76 L78 108 L22 108 Z" fill={fill} />;
  }
}
