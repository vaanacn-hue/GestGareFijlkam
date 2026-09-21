import React, { useState, useMemo } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme } from "@/src/theme";
import { spacing, fontSize, radius } from "@/src/tokens";
import { api } from "@/src/api/client";
import { usesNativeTabs } from "@/src/navigation";
import { Badge, Card, EmptyState } from "@/src/components/ui";
import { formatDateRange } from "@/src/utils/date";

type Item = {
  key: string;
  name: string;
  start_date: string;
  end_date: string;
  address: string;
  kind: "pending" | "available" | "unavailable" | "confirmed";
};

const FILTERS = [
  { key: "all", label: "Tutte" },
  { key: "confirmed", label: "Confermate" },
  { key: "pending", label: "Da rispondere" },
  { key: "available", label: "Disponibile" },
];

export default function OfficialCompetitions() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [filter, setFilter] = useState("all");

  const requests = useQuery({
    queryKey: ["my-requests"],
    queryFn: () => api.get<any[]>("/my/requests"),
  });
  const myComps = useQuery({
    queryKey: ["my-competitions"],
    queryFn: () => api.get<any[]>("/my/competitions"),
  });

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    (requests.data ?? []).forEach((r) =>
      out.push({
        key: r.availability_id,
        name: r.name,
        start_date: r.start_date,
        end_date: r.end_date,
        address: r.address,
        kind: "pending",
      }),
    );
    (myComps.data ?? []).forEach((c) =>
      out.push({
        key: c.competition_id,
        name: c.name,
        start_date: c.start_date,
        end_date: c.end_date,
        address: c.address,
        kind: c.confirmed ? "confirmed" : (c.status as any),
      }),
    );
    out.sort((a, b) => a.start_date.localeCompare(b.start_date));
    return out;
  }, [requests.data, myComps.data]);

  const filtered = items.filter((i) => filter === "all" || i.kind === filter);
  const refreshing = requests.isRefetching || myComps.isRefetching;

  const badge = (kind: Item["kind"]) =>
    kind === "confirmed" ? (
      <Badge label="Confermato" tone="success" />
    ) : kind === "available" ? (
      <Badge label="Disponibile" tone="info" />
    ) : kind === "unavailable" ? (
      <Badge label="Non disponibile" tone="neutral" />
    ) : (
      <Badge label="Da rispondere" tone="warning" />
    );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>Le mie gare</Text>
      </View>

      {/* filter chips */}
      <View style={styles.chipsWrap}>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(f) => f.key}
          contentContainerStyle={styles.chipsRow}
          renderItem={({ item }) => {
            const active = filter === item.key;
            return (
              <Pressable
                testID={`filter-${item.key}`}
                onPress={() => setFilter(item.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.key}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, paddingBottom: bottomChrome + spacing.xl, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              requests.refetch();
              myComps.refetch();
            }}
            tintColor={colors.brandPrimary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="calendar-outline"
              title="Nessuna gara"
              subtitle="Qui vedrai le gare a cui sei associato."
            />
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {badge(item.kind)}
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
          </Card>
        )}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  headerTitle: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface },
  chipsWrap: {
    height: 56,
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chipsRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurfaceTertiary },
  chipTextActive: { color: colors.onBrandPrimary },
  emptyWrap: { flex: 1, justifyContent: "center" },
  card: { marginBottom: spacing.md, gap: spacing.xs },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  name: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, flex: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, flexShrink: 1 },
}));
