import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme } from "@/src/theme";
import { spacing, fontSize, radius } from "@/src/tokens";
import { api, ApiError } from "@/src/api/client";
import { AppButton, Card } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";

export default function Settings() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const [days, setDays] = useState<number | null>(null);

  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ days_before: number }>("/settings"),
  });

  const value = days ?? data?.days_before ?? 7;

  const save = useMutation({
    mutationFn: () => api.put("/settings", { days_before: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["competitions"] });
      toast.show("Impostazioni salvate", "success");
      router.back();
    },
    onError: (e: ApiError) => toast.show(e.detail, "error"),
  });

  const set = (v: number) => setDays(Math.max(0, Math.min(365, v)));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Impostazioni</Text>
        <Pressable testID="close-settings" onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <Text style={styles.cardTitle}>Richiesta disponibilità</Text>
          <Text style={styles.cardSub}>
            Giorni di anticipo con cui inviare automaticamente la richiesta di disponibilità agli
            ufficiali di gara.
          </Text>

          <View style={styles.stepper}>
            <Pressable
              testID="days-minus"
              onPress={() => set(value - 1)}
              style={styles.stepBtn}
            >
              <Ionicons name="remove" size={26} color={colors.brandPrimary} />
            </Pressable>
            <View style={styles.valueBox}>
              <Text style={styles.valueNum} testID="days-value">
                {value}
              </Text>
              <Text style={styles.valueLabel}>giorni prima</Text>
            </View>
            <Pressable testID="days-plus" onPress={() => set(value + 1)} style={styles.stepBtn}>
              <Ionicons name="add" size={26} color={colors.brandPrimary} />
            </Pressable>
          </View>

          <View style={styles.presets}>
            {[3, 7, 14, 30].map((p) => (
              <Pressable
                key={p}
                testID={`preset-${p}`}
                onPress={() => set(p)}
                style={[styles.preset, value === p && styles.presetActive]}
              >
                <Text style={[styles.presetText, value === p && styles.presetTextActive]}>{p}g</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <AppButton
          testID="save-settings"
          title="Salva impostazioni"
          onPress={() => save.mutate()}
          loading={save.isPending}
          icon="checkmark"
          style={{ marginTop: spacing.lg }}
        />
      </KeyboardAwareScrollView>
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
  cardTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface },
  cardSub: { fontSize: fontSize.base, color: colors.muted, marginTop: spacing.xs, lineHeight: 20 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  stepBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  valueBox: { alignItems: "center" },
  valueNum: { fontSize: 44, fontWeight: "900", color: colors.brandPrimary },
  valueLabel: { fontSize: fontSize.base, color: colors.muted, fontWeight: "600" },
  presets: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  preset: {
    flex: 1,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  presetText: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurfaceTertiary },
  presetTextActive: { color: colors.onBrandPrimary },
}));
