import React from "react";
import { ImageBackground, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeStyles } from "@/src/theme";
import { spacing, fontSize } from "@/src/tokens";

export function HeroHeader({
  image,
  title,
  subtitle,
  right,
  height = 180,
}: {
  image: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  height?: number;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <ImageBackground source={{ uri: image }} style={[styles.bg, { height: height + insets.top }]}>
      <LinearGradient
        colors={["rgba(11,22,44,0.35)", "rgba(11,22,44,0.92)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.row}>
          <View style={styles.textCol}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {right}
        </View>
      </View>
    </ImageBackground>
  );
}

const useStyles = makeStyles((colors) => ({
  bg: { width: "100%", justifyContent: "flex-end", backgroundColor: colors.brand },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md },
  textCol: { flex: 1 },
  title: { color: "#FFFFFF", fontSize: fontSize["2xl"], fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.82)", fontSize: fontSize.base, marginTop: 2, fontWeight: "500" },
}));
