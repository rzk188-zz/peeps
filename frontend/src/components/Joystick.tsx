import React, { useRef, useState } from "react";
import { View, StyleSheet, PanResponder, Text } from "react-native";
import { colors } from "@/src/theme";

type Props = {
  size?: number;
  onMove: (dx: number, dy: number) => void; // normalized -1..1
  onRelease?: () => void;
};

/**
 * Floating virtual joystick.
 * - User drags the inner knob; we emit normalized dx, dy each move.
 * - Parent uses these to push the avatar in that direction every frame.
 */
export function Joystick({ size = 110, onMove, onRelease }: Props) {
  const radius = size / 2;
  const innerSize = size * 0.45;
  const innerRadius = innerSize / 2;
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        const max = radius - innerRadius;
        let x = gs.dx;
        let y = gs.dy;
        const d = Math.sqrt(x * x + y * y);
        if (d > max) {
          x = (x / d) * max;
          y = (y / d) * max;
        }
        setKnob({ x, y });
        onMove(x / max, y / max);
      },
      onPanResponderRelease: () => {
        setKnob({ x: 0, y: 0 });
        onMove(0, 0);
        onRelease?.();
      },
      onPanResponderTerminate: () => {
        setKnob({ x: 0, y: 0 });
        onMove(0, 0);
        onRelease?.();
      },
    })
  ).current;

  return (
    <View
      testID="joystick"
      style={[
        styles.base,
        { width: size, height: size, borderRadius: radius },
      ]}
      {...responder.panHandlers}
    >
      <View
        style={[
          styles.knob,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerRadius,
            transform: [{ translateX: knob.x }, { translateY: knob.y }],
          },
        ]}
      >
        <Text style={styles.knobIcon}>✦</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  knob: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  knobIcon: { color: "#fff", fontWeight: "900", fontSize: 22 },
});
