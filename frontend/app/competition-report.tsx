import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme } from "@/src/theme";
import { spacing, fontSize, radius } from "@/src/tokens";
import { api } from "@/src/api/client";
import { AppButton, Card } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { formatDateRange } from "@/src/utils/date";

type Report = {
  name: string;
  start_date: string;
  end_date: string;
  address: string;
  notes: string;
  confirmed_count: number;
  present_count: number;
  absent_count: number;
  officials: { official_name: string; username: string; attended: boolean }[];
};

export default function CompetitionReport() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["report", id],
    queryFn: () => api.get<Report>(`/competitions/${id}/report`),
  });

  const share = async () => {
    if (!data) return;
    const lines = [
      `REPORT PRESENZE — ${data.name}`,
      `Date: ${formatDateRange(data.start_date, data.end_date)}`,
      `Luogo: ${data.address}`,
      "",
      `Confermati: ${data.confirmed_count} | Presenti: ${data.present_count} | Assenti: ${data.absent_count}`,
      "",
      "Ufficiale;Username;Stato",
      ...data.officials.map(
        (o) => `${o.official_name};${o.username};${o.attended ? "Presente" : "Assente"}`,
      ),
    ];
    try {
      await Share.share({ message: lines.join("\n"), title: `Report ${data.name}` });
    } catch {
      toast.show("Condivisione annullata", "info");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Report presenze</Text>
        <Pressable testID="close-report" onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
      </View>

      {isLoading || !data ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          <Card style={{ gap: spacing.xs }}>
            <Text style={styles.compName}>{data.name}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={15} color={colors.muted} />
              <Text style={styles.metaText}>{formatDateRange(data.start_date, data.end_date)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={15} color={colors.muted} />
              <Text style={styles.metaText}>{data.address}</Text>
            </View>
          </Card>

          <View style={styles.statsRow}>
            <View style={[styles.stat, { backgroundColor: colors.brandTertiary }]}>
              <Text style={[styles.statNum, { color: colors.brandPrimary }]}>{data.confirmed_count}</Text>
              <Text style={styles.statLabel}>Confermati</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: "#E7F6EE" }]}>
              <Text style={[styles.statNum, { color: colors.success }]}>{data.present_count}</Text>
              <Text style={styles.statLabel}>Presenti</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: "#FDECEC" }]}>
              <Text style={[styles.statNum, { color: colors.error }]}>{data.absent_count}</Text>
              <Text style={styles.statLabel}>Assenti</Text>
            </View>
          </View>

          {data.officials.map((o) => (
            <Card key={o.username} style={styles.row}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: o.attended ? colors.success : colors.error },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{o.official_name}</Text>
                <Text style={styles.user}>@{o.username}</Text>
              </View>
              <Ionicons
                name={o.attended ? "checkmark-circle" : "close-circle"}
                size={24}
                color={o.attended ? colors.success : colors.error}
              />
            </Card>
          ))}

          {data.officials.length === 0 ? (
            <Text style={styles.empty}>Nessun ufficiale confermato per questa gara.</Text>
          ) : null}

          <AppButton
            testID="share-report"
            title="Condividi / Esporta report"
            icon="share-outline"
            onPress={share}
            style={{ marginTop: spacing.lg }}
          />
        </ScrollView>
      )}
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
  title: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  compName: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, flexShrink: 1 },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.lg },
  stat: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  statNum: { fontSize: 28, fontWeight: "900" },
  statLabel: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface },
  user: { fontSize: fontSize.base, color: colors.muted },
  empty: { fontSize: fontSize.base, color: colors.muted, textAlign: "center", marginVertical: spacing.lg },
}));
