import React from "react";
import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { Appearance, DEFAULT_APPEARANCE } from "@/src/avatarOptions";

/**
 * Pixel-art avatar built as a 16x22 SVG grid.
 * - Each cell is one "pixel" (Rect) → chunky retro look with shapeRendering=crispEdges.
 * - Colors driven by user appearance (skin/hair_color/eyes/shirt_color/pants_color).
 * - hair_style switches the hair sprite pattern.
 */

type Props = {
  appearance?: Partial<Appearance> | null;
  size?: number;
};

const W = 16;
const H = 22;

const SHOE = "#2A2A2A";
const MOUTH = "#3D2418";

type Cell = "." | "S" | "H" | "E" | "T" | "P" | "B" | "M" | "O"; // O = outline

// Base body grid (skin, mouth, shirt, pants, shoe, outline). Hair gets layered on top.
// Use ' ' for transparency in the source for readability.
const BODY_ROWS: string[] = [
  /* 0  */ "                ",
  /* 1  */ "                ",
  /* 2  */ "    OSSSSSSO    ",
  /* 3  */ "   OSSSSSSSSO   ",
  /* 4  */ "   OSSSSSSSSO   ",
  /* 5  */ "   OSSSSSSSSO   ",
  /* 6  */ "   OSESSSSESO   ", // eyes
  /* 7  */ "   OSSSSSSSSO   ",
  /* 8  */ "   OSSSMMSSSO   ", // mouth
  /* 9  */ "   OSSSSSSSSO   ",
  /* 10 */ "    OSSSSSSO    ", // neck/chin
  /* 11 */ "    OOSSSSOO    ", // neck
  /* 12 */ "   OTTTTTTTTO   ", // shirt top
  /* 13 */ "  OTTTTTTTTTTO  ",
  /* 14 */ "  OTTTTTTTTTTO  ",
  /* 15 */ "  OTTTTTTTTTTO  ",
  /* 16 */ "   OTTTTTTTTO   ",
  /* 17 */ "   OPPPPPPPPO   ", // pants
  /* 18 */ "   OPPPPPPPPO   ",
  /* 19 */ "   OPPPPPPPPO   ",
  /* 20 */ "   OBBOOOOBBO   ", // shoes
  /* 21 */ "    OOO  OOO    ",
];

// Hair patterns — overlay onto rows 1..6 (and possibly side rows)
const HAIR_PATTERNS: Record<string, string[]> = {
  short: [
    "                ",
    "    HHHHHHHH    ",
    "   HHHHHHHHHH   ",
    "  HHHHHHHHHHHH  ",
    "  HHHH    HHHH  ",
    "  HH        HH  ",
    "                ",
  ],
  bob: [
    "    HHHHHHHH    ",
    "   HHHHHHHHHH   ",
    "  HHHHHHHHHHHH  ",
    "  HHHHHHHHHHHH  ",
    "  HHH      HHH  ",
    "   HH      HH   ",
    "                ",
  ],
  long: [
    "    HHHHHHHH    ",
    "   HHHHHHHHHH   ",
    "  HHHHHHHHHHHH  ",
    " HHHHHHHHHHHHHH ",
    " HH  HHHHHH  HH ",
    " HH        HH HH",
    " HH        HH HH",
  ],
  ponytail: [
    "    HHHHHHHHHHH ",
    "   HHHHHHHHHHHHH",
    "  HHHHHHHHHHHHHH",
    "  HHHHHHHHHH    ",
    "  HH    HHHH    ",
    "  HH      HH    ",
    "                ",
  ],
  twin: [
    "    HHHHHHHH    ",
    "   HHHHHHHHHH   ",
    " HHHHHHHHHHHHHH ",
    "HHHHHHHHHHHHHHHH",
    "HH  HH    HH  HH",
    "HH  HH    HH  HH",
    "    HH    HH    ",
  ],
  bun: [
    "      HHHH      ",
    "     HHHHHH     ",
    "    HHHHHHHH    ",
    "   HHHHHHHHHH   ",
    "  HHHH    HHHH  ",
    "  HH        HH  ",
    "                ",
  ],
  curly: [
    "  HH HH HH HH   ",
    " HHHHHHHHHHHH   ",
    "HHHHHHHHHHHHHH  ",
    "HHHHHHHHHHHHHH  ",
    " HHH      HHH   ",
    "  HH        HH  ",
    "                ",
  ],
  beanie: [
    "    BBBBBBBB    ",
    "   BBBBBBBBBB   ",
    "  BBBBBBBBBBBB  ",
    "  WWWWWWWWWWWW  ", // band
    "  HH        HH  ",
    "                ",
    "                ",
  ],
  bald: [],
};

function colorFor(
  ch: string,
  a: Appearance
): string | null {
  switch (ch) {
    case "S":
      return a.skin;
    case "H":
      return a.hair_color;
    case "E":
      return a.eye_color;
    case "T":
      return a.shirt_color;
    case "P":
      return a.pants_color;
    case "M":
      return MOUTH;
    case "B":
      return SHOE;
    case "O":
      return "rgba(0,0,0,0.35)"; // outline
    case "W":
      return "#FFFFFF";
    default:
      return null;
  }
}

export function Avatar({ appearance, size = 96 }: Props) {
  const a: Appearance = { ...DEFAULT_APPEARANCE, ...(appearance || {}) };
  const pixels: { x: number; y: number; fill: string }[] = [];

  // Body
  for (let y = 0; y < BODY_ROWS.length; y++) {
    const row = BODY_ROWS[y];
    for (let x = 0; x < W; x++) {
      const ch = row[x];
      const f = colorFor(ch, a);
      if (f) pixels.push({ x, y, fill: f });
    }
  }

  // Hair overlay - draws on rows 1..7
  const hair = HAIR_PATTERNS[a.hair_style] || HAIR_PATTERNS.short;
  for (let r = 0; r < hair.length; r++) {
    const row = hair[r];
    if (!row) continue;
    for (let x = 0; x < W; x++) {
      const ch = row[x];
      if (ch === "H") pixels.push({ x, y: r + 1, fill: a.hair_color });
      else if (ch === "B") pixels.push({ x, y: r + 1, fill: a.shirt_color }); // beanie color uses shirt
      else if (ch === "W") pixels.push({ x, y: r + 1, fill: "#FFFFFF" });
    }
  }

  // Cheek blush
  pixels.push({ x: 4, y: 8, fill: "rgba(255,150,170,0.35)" });
  pixels.push({ x: 11, y: 8, fill: "rgba(255,150,170,0.35)" });

  const display = size;
  const viewH = (display * H) / W;

  return (
    <View pointerEvents="none" style={{ width: display, height: viewH }}>
      <Svg width={display} height={viewH} viewBox={`0 0 ${W} ${H}`}>
        {pixels.map((p, i) => (
          <Rect
            key={i}
            x={p.x}
            y={p.y}
            width={1}
            height={1}
            fill={p.fill}
            shapeRendering="crispEdges"
          />
        ))}
      </Svg>
    </View>
  );
}
