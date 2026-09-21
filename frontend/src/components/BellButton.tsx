import React from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/api/client";
import { radius } from "@/src/tokens";

export function BellButton({ onPress, light }: { onPress: () => void; light?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { data } = useQuery({
    queryKey: ["unread-count"],
    queryFn: () => api.get<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 15000,
  });
  const count = data?.count ?? 0;
  return (
    <Pressable testID="bell-button" onPress={onPress} style={styles.wrap} hitSlop={10}>
      <Ionicons
        name="notifications-outline"
        size={24}
        color={light ? "#FFFFFF" : colors.onSurface}
      />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.onError, fontSize: 10, fontWeight: "800" },
}));
