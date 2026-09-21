import React from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { api } from "@/src/api/client";
import { spacing, fontSize, radius } from "@/src/tokens";
import { EmptyState } from "@/src/components/ui";
import { relativeTime } from "@/src/utils/date";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

const iconFor = (t: string) =>
  t === "confirmation"
    ? "checkmark-circle"
    : t === "availability_request"
      ? "help-circle"
      : t === "response"
        ? "chatbox-ellipses"
        : "notifications";

export function NotificationsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<Notif[]>("/notifications"),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });

  const hasUnread = (data ?? []).some((n) => !n.read);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>Avvisi</Text>
        {hasUnread && (
          <Pressable testID="mark-all-read" onPress={() => markAll.mutate()} hitSlop={8}>
            <Text style={styles.markAll}>Segna letti</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        data={data ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyWrap}>
              <EmptyState icon="notifications-outline" title="Nessun avviso" subtitle="Sei aggiornato su tutto." />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`notification-${item.id}`}
            onPress={() => !item.read && markRead.mutate(item.id)}
            style={[styles.row, !item.read && { backgroundColor: colors.brandTertiary }]}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={iconFor(item.type) as any} size={22} color={colors.brandPrimary} />
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                {!item.read && <View style={styles.dot} />}
              </View>
              <Text style={styles.text}>{item.body}</Text>
              <Text style={styles.time}>{relativeTime(item.created_at)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface },
  markAll: { color: colors.brandPrimary, fontSize: fontSize.base, fontWeight: "700" },
  emptyWrap: { flex: 1, justifyContent: "center" },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary },
  text: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, lineHeight: 20 },
  time: { fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
}));
