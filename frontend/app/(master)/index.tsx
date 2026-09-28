import React from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme } from "@/src/theme";
import { spacing, fontSize, radius, images } from "@/src/tokens";
import { api, AppUser } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { usesNativeTabs } from "@/src/navigation";
import { HeroHeader } from "@/src/components/HeroHeader";
import { BellButton } from "@/src/components/BellButton";
import { Card, EmptyState, SectionHeader, Badge } from "@/src/components/ui";
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
  unavailable_count: number;
  request_sent: boolean;
};

export default function Dashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  const comps = useQuery({
    queryKey: ["competitions"],
    queryFn: () => api.get<Comp[]>("/competitions"),
  });
  const officials = useQuery({
    queryKey: ["officials"],
    queryFn: () => api.get<AppUser[]>("/officials"),
  });

  const pendingConfirm = (comps.data ?? []).reduce((s, c) => s + c.available_count, 0);
  const refreshing = comps.isRefetching || officials.isRefetching;

  const quickActions = [
    { label: "Nuova gara", icon: "add-circle", onPress: () => router.push("/competition-form") },
    { label: "Nuovo ufficiale", icon: "person-add", onPress: () => router.push("/official-form") },
    { label: "Impostazioni", icon: "settings", onPress: () => router.push("/settings") },
  ];

  return (
    <View style={styles.container}>
      <HeroHeader
        image={images.heroMaster}
        title="GaraMaster"
        subtitle="Pannello master"
        right={
          <View style={styles.heroActions}>
            <BellButton light onPress={() => router.push("/(master)/notifications")} />
            <Pressable testID="logout-button" onPress={handleLogout} hitSlop={8} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              comps.refetch();
              officials.refetch();
            }}
            tintColor={colors.brandPrimary}
          />
        }
      >
        {/* Quick actions */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          {quickActions.map((a) => (
            <Pressable
              key={a.label}
              testID={`quick-${a.icon}`}
              onPress={a.onPress}
              style={styles.chip}
            >
              <Ionicons name={a.icon as any} size={18} color={colors.brandPrimary} />
              <Text style={styles.chipText}>{a.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard} testID="stat-officials">
            <View style={[styles.statIcon, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="people" size={22} color={colors.brandPrimary} />
            </View>
            <Text style={styles.statValue}>{officials.data?.length ?? 0}</Text>
            <Text style={styles.statLabel}>Ufficiali</Text>
          </Card>
          <Card style={styles.statCard} testID="stat-pending">
            <View style={[styles.statIcon, { backgroundColor: "#FEF3E2" }]}>
              <Ionicons name="hourglass" size={22} color={colors.warning} />
            </View>
            <Text style={styles.statValue}>{pendingConfirm}</Text>
            <Text style={styles.statLabel}>Da confermare</Text>
          </Card>
        </View>

        {/* Upcoming competitions */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader
            title="Gare in programma"
            right={
              <Pressable onPress={() => router.push("/(master)/competitions")} hitSlop={6}>
                <Text style={styles.link}>Tutte</Text>
              </Pressable>
            }
          />
          {comps.isLoading ? null : (comps.data ?? []).length === 0 ? (
            <Card>
              <EmptyState
                icon="calendar-outline"
                title="Nessuna gara attiva"
                subtitle="Crea una nuova gara per iniziare."
              />
            </Card>
          ) : (
            (comps.data ?? []).slice(0, 5).map((c) => (
              <Pressable
                key={c.id}
                testID={`comp-card-${c.id}`}
                onPress={() => router.push(`/competition/${c.id}`)}
              >
                <Card style={styles.compCard}>
                  <View style={styles.compHead}>
                    <Text style={styles.compName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    {c.confirmed_count > 0 ? (
                      <Badge label={`${c.confirmed_count} confermati`} tone="success" />
                    ) : c.request_sent ? (
                      <Badge label="Richiesta inviata" tone="info" />
                    ) : (
                      <Badge label="In attesa" tone="warning" />
                    )}
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={15} color={colors.muted} />
                    <Text style={styles.metaText}>{formatDateRange(c.start_date, c.end_date)}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={15} color={colors.muted} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {c.address}
                    </Text>
                  </View>
                  <View style={styles.pillRow}>
                    <View style={styles.miniPill}>
                      <Text style={styles.miniPillNum}>{c.available_count}</Text>
                      <Text style={styles.miniPillLabel}>disponibili</Text>
                    </View>
                    <View style={styles.miniPill}>
                      <Text style={styles.miniPillNum}>{c.pending_count}</Text>
                      <Text style={styles.miniPillLabel}>in attesa</Text>
                    </View>
                    <View style={styles.miniPill}>
                      <Text style={[styles.miniPillNum, { color: colors.error }]}>
                        {c.unavailable_count}
                      </Text>
                      <Text style={styles.miniPillLabel}>non disp.</Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  heroActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  logoutBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  chipsScroll: { marginHorizontal: -spacing.lg },
  chipsRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  chipText: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface },
  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  statCard: { flex: 1, gap: spacing.xs },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  statValue: { fontSize: 30, fontWeight: "900", color: colors.onSurface },
  statLabel: { fontSize: fontSize.base, color: colors.muted, fontWeight: "600" },
  link: { color: colors.brandPrimary, fontWeight: "700", fontSize: fontSize.base },
  compCard: { marginBottom: spacing.md, gap: spacing.xs },
  compHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  compName: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, flex: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, flexShrink: 1 },
  pillRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  miniPill: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  miniPillNum: { fontSize: fontSize.lg, fontWeight: "800", color: colors.brandPrimary },
  miniPillLabel: { fontSize: fontSize.sm, color: colors.muted, fontWeight: "600" },
}));
