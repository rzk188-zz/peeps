// Layered chibi avatar options
export type Appearance = {
  hair_style: string; // matches CHIBI_ASSETS.hair_*
  hair_color: string; // tint color
  outfit: string; // matches CHIBI_ASSETS.outfit_*
  // kept for backwards compat with backend / customize page; UI tints body lightly
  skin: string;
  eyes?: string;
  eye_color?: string;
  shirt_color?: string;
  shirt_style?: string;
  pants_color?: string;
};

export const DEFAULT_APPEARANCE: Appearance = {
  hair_style: "short",
  hair_color: "#3D2C1E",
  outfit: "tee",
  skin: "#FFE0BD",
  eyes: "round",
  eye_color: "#3D2C1E",
  shirt_color: "#FFB7B2",
  shirt_style: "tee",
  pants_color: "#7BB8E0",
};

export const HAIR_OPTIONS = [
  { id: "short", label: "短髮" },
  { id: "long", label: "長髮" },
  { id: "twin", label: "雙馬尾" },
  { id: "bun", label: "丸子" },
  { id: "beanie", label: "毛帽" },
  { id: "curly", label: "捲髮" },
];

export const HAIR_COLORS = [
  "#1F1F1F",
  "#3D2C1E",
  "#7A4A1F",
  "#B07B3F",
  "#E2C28C",
  "#E07A8A",
  "#9C6FE0",
  "#6EC1E4",
  "#E5E5E5",
];

export const OUTFIT_OPTIONS = [
  { id: "tee", label: "T恤" },
  { id: "dress", label: "洋裝" },
  { id: "hoodie", label: "連帽" },
  { id: "overalls", label: "吊帶" },
  { id: "pajamas", label: "睡衣" },
  { id: "sweater", label: "毛衣" },
];

// kept for backwards compat with old customize page (no longer primary)
export const SKIN_OPTIONS = ["#FFE7D1", "#FFE0BD", "#F5C9A0", "#E8B080", "#D89A6A", "#B97A53"];
export const EYE_STYLES = [{ id: "round", label: "圓眼" }];
export const EYE_COLORS = ["#3D2C1E"];
export const SHIRT_STYLES = OUTFIT_OPTIONS;
export const SHIRT_COLORS = HAIR_COLORS;
export const PANTS_COLORS = HAIR_COLORS;
export const HAIR_STYLES = HAIR_OPTIONS;
