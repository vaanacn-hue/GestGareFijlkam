import React from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme } from "@/src/theme";
import { spacing, fontSize, radius, images } from "@/src/tokens";
import { api, ApiError } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { usesNativeTabs } from "@/src/navigation";
import { HeroHeader } from "@/src/components/HeroHeader";
import { BellButton } from "@/src/components/BellButton";
import { AppButton, Badge, Card, EmptyState, SectionHeader } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { formatDateRange } from "@/src/utils/date";

type Req = {
  availability_id: string;
  competition_id: string;
  name: string;
  start_date: string;
  end_date: string;
  address: string;
  notes: string;
};

type MyComp = {
  competition_id: string;
  name: string;
  start_date: string;
  end_date: string;
  address: string;
  status: string;
  confirmed: boolean;
  attended: boolean | null;
};

export default function OfficialHome() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { user, signOut } = useAuth();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  const requests = useQuery({
    queryKey: ["my-requests"],
    queryFn: () => api.get<Req[]>("/my/requests"),
  });
  const myComps = useQuery({
    queryKey: ["my-competitions"],
    queryFn: () => api.get<MyComp[]>("/my/competitions"),
  });
  const stats = useQuery({
    queryKey: ["my-stats"],
    queryFn: () =>
      api.get<{ confirmed: number; present: number; absent: number; percentage: number }>(
        "/my/stats",
      ),
  });

  const respond = useMutation({
    mutationFn: ({ availId, status }: { availId: string; status: string }) =>
      api.post(`/availabilities/${availId}/respond`, { status }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      qc.invalidateQueries({ queryKey: ["my-competitions"] });
      qc.invalidateQueries({ queryKey: ["my-stats"] });
      qc.invalidateQueries({ queryKey: ["unread-count"] });
      toast.show(
        v.status === "available" ? "Hai dato disponibilità" : "Risposta inviata",
        v.status === "available" ? "success" : "info",
      );
    },
    onError: (e: ApiError) => toast.show(e.detail, "error"),
  });

  const refreshing = requests.isRefetching || myComps.isRefetching;
  const reqList = requests.data ?? [];
  const confirmed = (myComps.data ?? []).filter((c) => c.confirmed);
  const responded = (myComps.data ?? []).filter((c) => !c.confirmed);

  return (
    <View style={styles.container}>
      <HeroHeader
        image={images.heroOfficial}
        title={`Ciao, ${user?.first_name ?? ""}`}
        subtitle="Ufficiale di gara"
        right={
          <View style={styles.heroActions}>
            <BellButton light onPress={() => router.push("/(official)/notifications")} />
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
              requests.refetch();
              myComps.refetch();
              stats.refetch();
            }}
            tintColor={colors.brandPrimary}
          />
        }
      >
        {/* Riepilogo ufficiale */}
        <View style={styles.statsStrip} testID="official-stats">
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{stats.data?.confirmed ?? 0}</Text>
            <Text style={styles.statLabel}>Gare svolte</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{stats.data?.present ?? 0}</Text>
            <Text style={styles.statLabel}>Presenze</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.success }]}>
              {stats.data?.percentage ?? 0}%
            </Text>
            <Text style={styles.statLabel}>Presenza</Text>
          </View>
        </View>

        {/* Pending requests */}
        {reqList.length > 0 && (
          <SectionHeader title="Richieste di disponibilità" />
        )}
        {reqList.map((r) => (
          <Card key={r.availability_id} style={styles.reqCard} testID={`request-${r.availability_id}`}>
            <View style={styles.reqBadgeRow}>
              <Badge label="Disponibilità richiesta" tone="warning" />
            </View>
            <Text style={styles.reqName}>{r.name}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={15} color={colors.muted} />
              <Text style={styles.metaText}>{formatDateRange(r.start_date, r.end_date)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={15} color={colors.muted} />
              <Text style={styles.metaText} numberOfLines={2}>
                {r.address}
              </Text>
            </View>
            {r.notes ? <Text style={styles.notes}>{r.notes}</Text> : null}
            <View style={styles.reqBtns}>
              <AppButton
                testID={`decline-${r.availability_id}`}
                title="Non disponibile"
                variant="outline"
                onPress={() => respond.mutate({ availId: r.availability_id, status: "unavailable" })}
                style={{ flex: 1 }}
              />
              <AppButton
                testID={`accept-${r.availability_id}`}
                title="Disponibile"
                variant="success"
                icon="checkmark"
                onPress={() => respond.mutate({ availId: r.availability_id, status: "available" })}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ))}

        {/* Confirmed */}
        <View style={{ marginTop: reqList.length ? spacing.xl : 0 }}>
          <SectionHeader title="Gare confermate" />
          {confirmed.length === 0 ? (
            <Card>
              <EmptyState
                icon="ribbon-outline"
                title="Nessuna gara confermata"
                subtitle="Ti avviseremo quando sarai confermato per una gara."
              />
            </Card>
          ) : (
            confirmed.map((c) => (
              <Card key={c.competition_id} style={styles.confCard} testID={`confirmed-${c.competition_id}`}>
                <View style={styles.confHead}>
                  <Text style={styles.confName} numberOfLines={1}>
                    {c.name}
                  </Text>
                  {c.attended === true ? (
                    <Badge label="Presente" tone="success" />
                  ) : (
                    <Badge label="Confermato" tone="brand" />
                  )}
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={15} color={colors.muted} />
                  <Text style={styles.metaText}>{formatDateRange(c.start_date, c.end_date)}</Text>
                </View>
                <View style={styles.addressBox}>
                  <Ionicons name="location" size={16} color={colors.brandPrimary} />
                  <Text style={styles.addressText}>{c.address}</Text>
                </View>
              </Card>
            ))
          )}
        </View>

        {/* Awaiting confirmation */}
        {responded.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="In attesa di conferma" />
            {responded.map((c) => (
              <Card key={c.competition_id} style={styles.confCard}>
                <View style={styles.confHead}>
                  <Text style={styles.confName} numberOfLines={1}>
                    {c.name}
                  </Text>
                  {c.status === "available" ? (
                    <Badge label="Disponibile" tone="info" />
                  ) : (
                    <Badge label="Non disponibile" tone="neutral" />
                  )}
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={15} color={colors.muted} />
                  <Text style={styles.metaText}>{formatDateRange(c.start_date, c.end_date)}</Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  heroActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  logoutBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
  },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: colors.divider },
  statNum: { fontSize: 26, fontWeight: "900", color: colors.brandPrimary },
  statLabel: { fontSize: fontSize.sm, color: colors.muted, fontWeight: "600" },
  reqCard: { marginBottom: spacing.md, gap: spacing.xs, borderColor: colors.warning, borderWidth: 1 },
  reqBadgeRow: { flexDirection: "row" },
  reqName: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xs },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, flexShrink: 1 },
  notes: { fontSize: fontSize.base, color: colors.muted, marginTop: spacing.xs, fontStyle: "italic" },
  reqBtns: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  confCard: { marginBottom: spacing.md, gap: spacing.xs },
  confHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  confName: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, flex: 1 },
  addressBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandTertiary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  addressText: { fontSize: fontSize.base, color: colors.onBrandTertiary, fontWeight: "600", flex: 1 },
}));
