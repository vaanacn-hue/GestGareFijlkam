import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme } from "@/src/theme";
import { spacing, fontSize, radius } from "@/src/tokens";
import { api, ApiError } from "@/src/api/client";
import { AppButton, Badge, Card, EmptyState } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { formatDateRange } from "@/src/utils/date";

type Comp = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  address: string;
  notes: string;
  request_sent: boolean;
};

type Avail = {
  id: string;
  official_id: string;
  official_name: string;
  username: string;
  status: "pending" | "available" | "unavailable";
  confirmed: boolean;
  attended: boolean | null;
};

export default function CompetitionDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [tab, setTab] = useState<"availability" | "attendance">("availability");
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});

  const comp = useQuery({
    queryKey: ["competition", id],
    queryFn: () => api.get<Comp>(`/competitions/${id}`),
  });
  const avail = useQuery({
    queryKey: ["availabilities", id],
    queryFn: () => api.get<Avail[]>(`/competitions/${id}/availabilities`),
  });

  // initialise selection & attendance from server data once
  const selectedSet = useMemo(() => {
    if (selected) return selected;
    const s = new Set<string>();
    (avail.data ?? []).forEach((a) => a.confirmed && s.add(a.official_id));
    return s;
  }, [selected, avail.data]);

  const getAttended = (a: Avail) =>
    attendance[a.official_id] ?? a.attended ?? false;

  const confirmM = useMutation({
    mutationFn: () =>
      api.post(`/competitions/${id}/confirm`, {
        official_ids: Array.from(selectedSet),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availabilities", id] });
      qc.invalidateQueries({ queryKey: ["competitions"] });
      qc.invalidateQueries({ queryKey: ["competition", id] });
      toast.show("Presenze confermate", "success");
    },
    onError: (e: ApiError) => toast.show(e.detail, "error"),
  });

  const attendanceM = useMutation({
    mutationFn: () =>
      api.post(`/competitions/${id}/attendance`, {
        records: (avail.data ?? [])
          .filter((a) => a.confirmed)
          .map((a) => ({ official_id: a.official_id, attended: getAttended(a) })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availabilities", id] });
      toast.show("Presenze registrate", "success");
    },
    onError: (e: ApiError) => toast.show(e.detail, "error"),
  });

  const sendReq = useMutation({
    mutationFn: () => api.post(`/competitions/${id}/send-request`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availabilities", id] });
      qc.invalidateQueries({ queryKey: ["competition", id] });
      qc.invalidateQueries({ queryKey: ["competitions"] });
      toast.show("Richiesta inviata agli ufficiali", "success");
    },
    onError: (e: ApiError) => toast.show(e.detail, "error"),
  });

  const delM = useMutation({
    mutationFn: () => api.del(`/competitions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitions"] });
      toast.show("Gara eliminata", "success");
      router.back();
    },
    onError: (e: ApiError) => toast.show(e.detail, "error"),
  });

  const toggleSelect = (officialId: string) => {
    const next = new Set(selectedSet);
    if (next.has(officialId)) next.delete(officialId);
    else next.add(officialId);
    setSelected(next);
  };

  if (comp.isLoading || !comp.data) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  const c = comp.data;
  const list = avail.data ?? [];
  const available = list.filter((a) => a.status === "available");
  const unavailable = list.filter((a) => a.status === "unavailable");
  const pending = list.filter((a) => a.status === "pending");
  const confirmedList = list.filter((a) => a.confirmed);

  const statusBadge = (a: Avail) =>
    a.status === "available" ? (
      <Badge label="Disponibile" tone="success" />
    ) : a.status === "unavailable" ? (
      <Badge label="Non disponibile" tone="error" />
    ) : (
      <Badge label="In attesa" tone="warning" />
    );

  return (
    <View style={styles.container}>
      {/* sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={8} style={styles.hIcon}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {c.name}
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            testID="open-report"
            onPress={() => router.push({ pathname: "/competition-report", params: { id } })}
            hitSlop={8}
            style={styles.hIcon}
          >
            <Ionicons name="stats-chart-outline" size={21} color={colors.brandPrimary} />
          </Pressable>
          <Pressable
            testID="edit-competition"
            onPress={() => router.push({ pathname: "/competition-form", params: { id } })}
            hitSlop={8}
            style={styles.hIcon}
          >
            <Ionicons name="create-outline" size={22} color={colors.brandPrimary} />
          </Pressable>
          <Pressable testID="delete-competition" onPress={() => delM.mutate()} hitSlop={8} style={styles.hIcon}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* info */}
        <Card style={{ gap: spacing.sm }}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.brandPrimary} />
            <Text style={styles.infoText}>{formatDateRange(c.start_date, c.end_date)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={colors.brandPrimary} />
            <Text style={styles.infoText}>{c.address}</Text>
          </View>
          {c.notes ? (
            <View style={styles.infoRow}>
              <Ionicons name="document-text-outline" size={18} color={colors.brandPrimary} />
              <Text style={styles.infoText}>{c.notes}</Text>
            </View>
          ) : null}
          {!c.request_sent ? (
            <AppButton
              testID="send-request"
              title="Invia richiesta disponibilità"
              icon="send"
              variant="secondary"
              loading={sendReq.isPending}
              onPress={() => sendReq.mutate()}
              style={{ marginTop: spacing.sm }}
            />
          ) : (
            <View style={styles.sentPill}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.sentText}>Richiesta inviata agli ufficiali</Text>
            </View>
          )}
        </Card>

        {/* segmented control */}
        <View style={styles.segment}>
          <Pressable
            testID="tab-availability"
            onPress={() => setTab("availability")}
            style={[styles.segBtn, tab === "availability" && styles.segActive]}
          >
            <Text style={[styles.segText, tab === "availability" && styles.segTextActive]}>
              Disponibilità
            </Text>
          </Pressable>
          <Pressable
            testID="tab-attendance"
            onPress={() => setTab("attendance")}
            style={[styles.segBtn, tab === "attendance" && styles.segActive]}
          >
            <Text style={[styles.segText, tab === "attendance" && styles.segTextActive]}>
              Presenze
            </Text>
          </Pressable>
        </View>

        {tab === "availability" ? (
          list.length === 0 ? (
            <Card>
              <EmptyState
                icon="paper-plane-outline"
                title="Nessuna richiesta"
                subtitle="Invia la richiesta di disponibilità per raccogliere le risposte."
              />
            </Card>
          ) : (
            <>
              <Text style={styles.hint}>
                Seleziona gli ufficiali disponibili da confermare per la gara.
              </Text>
              {available.map((a) => {
                const sel = selectedSet.has(a.official_id);
                return (
                  <Pressable
                    key={a.id}
                    testID={`select-${a.official_id}`}
                    onPress={() => toggleSelect(a.official_id)}
                  >
                    <Card style={[styles.availRow, sel && styles.availRowSel]}>
                      <View style={[styles.checkbox, sel && styles.checkboxOn]}>
                        {sel && <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} />}
                      </View>
                      <View style={styles.availInfo}>
                        <Text style={styles.availName}>{a.official_name}</Text>
                        <Text style={styles.availUser}>@{a.username}</Text>
                      </View>
                      {statusBadge(a)}
                    </Card>
                  </Pressable>
                );
              })}
              {[...pending, ...unavailable].map((a) => (
                <Card key={a.id} style={styles.availRowMuted}>
                  <View style={styles.availInfo}>
                    <Text style={styles.availName}>{a.official_name}</Text>
                    <Text style={styles.availUser}>@{a.username}</Text>
                  </View>
                  {statusBadge(a)}
                </Card>
              ))}
            </>
          )
        ) : confirmedList.length === 0 ? (
          <Card>
            <EmptyState
              icon="clipboard-outline"
              title="Nessun ufficiale confermato"
              subtitle="Conferma prima le presenze dalla scheda Disponibilità."
            />
          </Card>
        ) : (
          <>
            <Text style={styles.hint}>Registra chi si è presentato alla gara.</Text>
            {confirmedList.map((a) => (
              <Card key={a.id} style={styles.availRow}>
                <View style={styles.availInfo}>
                  <Text style={styles.availName}>{a.official_name}</Text>
                  <Text style={styles.availUser}>@{a.username}</Text>
                </View>
                <View style={styles.presRow}>
                  <Text
                    style={[
                      styles.presLabel,
                      { color: getAttended(a) ? colors.success : colors.muted },
                    ]}
                  >
                    {getAttended(a) ? "Presente" : "Assente"}
                  </Text>
                  <Switch
                    testID={`attendance-${a.official_id}`}
                    value={getAttended(a)}
                    onValueChange={(v) =>
                      setAttendance((p) => ({ ...p, [a.official_id]: v }))
                    }
                    trackColor={{ true: colors.success, false: colors.borderStrong }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {/* sticky CTA */}
      {tab === "availability" && list.length > 0 && (
        <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
          <AppButton
            testID="confirm-officials"
            title={`Conferma presenze (${selectedSet.size})`}
            icon="checkmark-done"
            loading={confirmM.isPending}
            onPress={() => confirmM.mutate()}
          />
        </View>
      )}
      {tab === "attendance" && confirmedList.length > 0 && (
        <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
          <AppButton
            testID="save-attendance"
            title="Salva presenze"
            icon="save"
            variant="success"
            loading={attendanceM.isPending}
            onPress={() => attendanceM.mutate()}
          />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface },
  headerActions: { flexDirection: "row" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  infoText: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, flex: 1 },
  sentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  sentText: { color: colors.success, fontWeight: "700", fontSize: fontSize.base },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: 4,
    marginVertical: spacing.lg,
  },
  segBtn: { flex: 1, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  segActive: { backgroundColor: colors.surface, shadowColor: "#0B162C", shadowOpacity: 0.08, shadowRadius: 4, elevation: 1 },
  segText: { fontSize: fontSize.base, fontWeight: "700", color: colors.muted },
  segTextActive: { color: colors.brandPrimary },
  hint: { fontSize: fontSize.base, color: colors.muted, marginBottom: spacing.md },
  availRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  availRowSel: { borderColor: colors.brandPrimary, borderWidth: 1.5 },
  availRowMuted: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
    opacity: 0.85,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  availInfo: { flex: 1 },
  availName: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface },
  availUser: { fontSize: fontSize.base, color: colors.muted },
  presRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  presLabel: { fontSize: fontSize.base, fontWeight: "700" },
  cta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
}));
