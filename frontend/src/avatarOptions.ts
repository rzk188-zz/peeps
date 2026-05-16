// Appearance option catalog for the customizable avatar.
// Keep keys in sync with backend DEFAULT_APPEARANCE and the Avatar component.

export type Appearance = {
  skin: string;
  eyes: string;
  eye_color: string;
  hair_style: string;
  hair_color: string;
  shirt_style: string;
  shirt_color: string;
  pants_color: string;
};

export const DEFAULT_APPEARANCE: Appearance = {
  skin: "#FFE0BD",
  eyes: "round",
  eye_color: "#3D2C1E",
  hair_style: "short",
  hair_color: "#3D2C1E",
  shirt_style: "tee",
  shirt_color: "#FFB5B5",
  pants_color: "#7BB8E0",
};

export const SKIN_OPTIONS = [
  "#FFE7D1",
  "#FFE0BD",
  "#F5C9A0",
  "#E8B080",
  "#D89A6A",
  "#B97A53",
  "#8B5A3C",
  "#5E3A23",
];

export const EYE_STYLES = [
  { id: "round", label: "圓眼" },
  { id: "sparkle", label: "閃亮" },
  { id: "sleepy", label: "瞇瞇" },
  { id: "cat", label: "貓眼" },
  { id: "dot", label: "點點" },
  { id: "wink", label: "眨眼" },
];

export const EYE_COLORS = [
  "#3D2C1E",
  "#6B3E1A",
  "#3F7BB6",
  "#3E8E5B",
  "#7B3FB6",
  "#B63F3F",
  "#1F1F1F",
];

export const HAIR_STYLES = [
  { id: "short", label: "短髮" },
  { id: "bob", label: "鮑伯" },
  { id: "long", label: "長髮" },
  { id: "ponytail", label: "馬尾" },
  { id: "twin", label: "雙馬尾" },
  { id: "bun", label: "丸子頭" },
  { id: "curly", label: "捲髮" },
  { id: "beanie", label: "毛帽" },
  { id: "bald", label: "光頭" },
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

export const SHIRT_STYLES = [
  { id: "tee", label: "T恤" },
  { id: "hoodie", label: "連帽" },
  { id: "stripe", label: "條紋" },
  { id: "dress", label: "洋裝" },
  { id: "overalls", label: "吊帶" },
  { id: "sweater", label: "毛衣" },
];

export const SHIRT_COLORS = [
  "#FFB5B5",
  "#FF8FA3",
  "#FFC8DD",
  "#A3E4D7",
  "#7BB8E0",
  "#FFE5A0",
  "#C9A0FF",
  "#FFFFFF",
  "#2D3436",
  "#E07A8A",
];

export const PANTS_COLORS = [
  "#7BB8E0",
  "#3F7BB6",
  "#2D3436",
  "#8B5A3C",
  "#A3A3A3",
  "#E07A8A",
  "#A3E4D7",
  "#FFE5A0",
];
