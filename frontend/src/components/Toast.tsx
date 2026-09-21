import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { radius, spacing, fontSize } from "@/src/tokens";

type ToastKind = "success" | "error" | "info";
type ToastCtx = { show: (message: string, kind?: ToastKind) => void };

const Ctx = createContext<ToastCtx>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState<ToastKind>("info");
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, k: ToastKind = "info") => {
      setMsg(message);
      setKind(k);
      setVisible(true);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(
          () => setVisible(false),
        );
      }, 2600);
    },
    [opacity],
  );

  const bg =
    kind === "success" ? colors.success : kind === "error" ? colors.error : colors.surfaceInverse;
  const icon =
    kind === "success" ? "checkmark-circle" : kind === "error" ? "alert-circle" : "information-circle";

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {visible && (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrap, { top: insets.top + spacing.md, opacity }]}
        >
          <View style={[styles.toast, { backgroundColor: bg }]} testID="app-toast">
            <Ionicons name={icon as any} size={20} color={colors.onSurfaceInverse} />
            <Text style={styles.text}>{msg}</Text>
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

const useStyles = makeStyles((colors) => ({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    maxWidth: 480,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: {
    color: colors.onSurfaceInverse,
    fontSize: fontSize.base,
    fontWeight: "600",
    flexShrink: 1,
  },
}));
