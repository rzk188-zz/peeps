export const colors = {
  // Dark pixel theme
  bg: "#0F0F12",
  surfaceDark: "#2A2A2A",
  surfaceDarkSoft: "#1F1F23",
  roomFloor: "#E8D4A6",
  roomBorder: "#D4BD8B",
  pillBorder: "rgba(255,255,255,0.08)",

  primary: "#FFD700",       // active ring / coin
  primaryDark: "#B89500",
  accent: "#00E5FF",         // energy
  pink: "#FF6FA0",
  red: "#FF3B30",
  green: "#34D399",
  ringInactive: "#444",

  text: "#FFFFFF",
  textSoft: "#A0A0A0",
  textOnTan: "#2D2419",

  // legacy aliases (still used by some screens)
  surface: "#1F1F23",
  secondary: "#00E5FF",
  border: "rgba(255,255,255,0.08)",
  bubbleMe: "#FFD700",
  bubbleThem: "#2A2A2A",
  yellow: "#FFE7A0",
};

export const PIXEL_CHAR_URLS = [
  "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/88ab6058bbd7fbbe1faa7773053f41391d5322005d9cf214d18e786d1fe1c39a.png",
  "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/572bdccbcb045fac41cbcd2caaa5f08c9dccf3055ee6ae9d31400ed839fc6f8b.png",
  "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/890d97cb37a1e29613b1f87576ee92d923f094425a4daa6233cdb8ba7e5db226.png",
];

export const PIXEL_FURNITURE_URLS: Record<string, string> = {
  bed: "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/7be72970c863a153eccdd6da09de97c896cc1524f6fa9f9a41ae672db582283b.png",
  plant: "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/cd4b356a720790f8a80271bad3b8bedb024eff8b923f8a734a552deea1b8563d.png",
  food: "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/e2f18f40f4468469941539343be195e03a7f5e97fb656e08a79872db47435f0d.png",
  fish: "https://static.prod-images.emergentagent.com/jobs/97b98978-bac4-4a61-91dc-a51413960b78/images/8e9ac6cf99c8d040a4c273165105974c1652f721e2db42a81e922966a7758cec.png",
};

export const ASSETS = {
  roomBg: "",
  avatarGirl: PIXEL_CHAR_URLS[1],
  avatarBoy: PIXEL_CHAR_URLS[0],
  bed: PIXEL_FURNITURE_URLS.bed,
  plant: PIXEL_FURNITURE_URLS.plant,
  table: PIXEL_FURNITURE_URLS.food,
  lamp: PIXEL_FURNITURE_URLS.fish,
};

export const FURNITURE_EMOJI: Record<string, string> = {
  bed: "🛏️",
  plant: "🪴",
  table: "🪑",
  lamp: "💡",
  tv: "📺",
  book: "📚",
  cake: "🍰",
  music: "🎵",
  cat: "🐱",
  dog: "🐶",
  heart: "💖",
  star: "⭐",
};
