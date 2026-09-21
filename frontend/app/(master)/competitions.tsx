import React from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme } from "@/src/theme";
import { spacing, fontSize, radius } from "@/src/tokens";
import { api } from "@/src/api/client";
import { usesNativeTabs } from "@/src/navigation";
import { Card, EmptyState, Badge } from "@/src/components/ui";
import { formatDateRange } from "@/src/utils/date";

type Comp = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  address: string;
  available_count: number;
  confirmed_count: number;
  pending_count: number;
  total_requests: number;
  request_sent: boolean;
};

export default function Competitions() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => api.get<Comp[]>("/competitions"),
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>Gare</Text>
        <Pressable
          testID="add-competition-header"
          onPress={() => router.push("/competition-form")}
          style={styles.addBtn}
          hitSlop={8}
        >
          <Ionicons name="add" size={26} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + 96, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="calendar-outline"
                title="Nessuna gara"
                subtitle="Tocca + per programmare la prima gara."
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable testID={`comp-row-${item.id}`} onPress={() => router.push(`/competition/${item.id}`)}>
            <Card style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={15} color={colors.muted} />
                <Text style={styles.metaText}>{formatDateRange(item.start_date, item.end_date)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={15} color={colors.muted} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {item.address}
                </Text>
              </View>
              <View style={styles.badges}>
                {item.confirmed_count > 0 && <Badge label={`${item.confirmed_count} confermati`} tone="success" />}
                {item.available_count > 0 && <Badge label={`${item.available_count} disponibili`} tone="info" />}
                {item.pending_count > 0 && <Badge label={`${item.pending_count} in attesa`} tone="warning" />}
                {!item.request_sent && <Badge label="Richiesta non inviata" tone="neutral" />}
              </View>
            </Card>
          </Pressable>
        )}
      />

      <Pressable
        testID="add-competition-fab"
        onPress={() => router.push("/competition-form")}
        style={[styles.fab, { bottom: bottomChrome + 16 }]}
      >
        <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: { flex: 1, justifyContent: "center" },
  card: { marginBottom: spacing.md, gap: spacing.xs },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  name: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, flex: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, flexShrink: 1 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0B162C",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
}));
