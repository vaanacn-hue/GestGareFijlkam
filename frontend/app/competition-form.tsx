import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme } from "@/src/theme";
import { spacing, fontSize, radius } from "@/src/tokens";
import { api, ApiError } from "@/src/api/client";
import { AppButton, TextField } from "@/src/components/ui";
import { DatePickerField } from "@/src/components/DatePickerField";
import { useToast } from "@/src/components/Toast";

type Comp = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  address: string;
  notes: string;
  required_officials: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function CompetitionForm() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [required, setRequired] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: existing } = useQuery({
    queryKey: ["competition", id],
    queryFn: () => api.get<Comp>(`/competitions/${id}`),
    enabled: isEdit,
  });

  if (isEdit && existing && !hydrated) {
    setName(existing.name);
    setStart(existing.start_date);
    setEnd(existing.end_date);
    setAddress(existing.address);
    setNotes(existing.notes ?? "");
    setRequired(existing.required_officials ?? 0);
    setHydrated(true);
  }

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        start_date: start,
        end_date: end || start,
        address: address.trim(),
        notes: notes.trim(),
        required_officials: required,
      };
      return isEdit ? api.patch(`/competitions/${id}`, body) : api.post("/competitions", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitions"] });
      qc.invalidateQueries({ queryKey: ["competition", id] });
      toast.show(isEdit ? "Gara aggiornata" : "Gara creata", "success");
      router.back();
    },
    onError: (e: ApiError) => toast.show(e.detail, "error"),
  });

  const onSubmit = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Obbligatorio";
    if (!DATE_RE.test(start)) errs.start = "Formato AAAA-MM-GG";
    if (end && !DATE_RE.test(end)) errs.end = "Formato AAAA-MM-GG";
    if (!address.trim()) errs.address = "Obbligatorio";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    save.mutate();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>{isEdit ? "Modifica gara" : "Nuova gara"}</Text>
        <Pressable testID="close-form" onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
      >
        <TextField
          testID="comp-name"
          label="Nome gara"
          placeholder="Es. Campionato Regionale"
          value={name}
          onChangeText={setName}
          error={errors.name}
        />
        <DatePickerField
          testID="comp-start"
          label="Data inizio"
          value={start}
          onChange={setStart}
          error={errors.start}
        />
        <DatePickerField
          testID="comp-end"
          label="Data fine (opzionale)"
          value={end}
          onChange={setEnd}
          error={errors.end}
        />
        <TextField
          testID="comp-address"
          label="Indirizzo"
          placeholder="Via, città"
          value={address}
          onChangeText={setAddress}
          error={errors.address}
        />
        <TextField
          testID="comp-notes"
          label="Note (opzionale)"
          placeholder="Informazioni aggiuntive"
          value={notes}
          onChangeText={setNotes}
          multiline
          style={styles.notes}
        />

        <Text style={styles.stepLabel}>Numero ufficiali richiesti</Text>
        <View style={styles.stepper}>
          <Pressable
            testID="required-minus"
            onPress={() => setRequired((v) => Math.max(0, v - 1))}
            style={styles.stepBtn}
          >
            <Ionicons name="remove" size={24} color={colors.brandPrimary} />
          </Pressable>
          <View style={styles.stepValueBox}>
            <Text style={styles.stepValue} testID="required-value">
              {required}
            </Text>
            <Text style={styles.stepHint}>{required === 0 ? "non specificato" : "ufficiali"}</Text>
          </View>
          <Pressable
            testID="required-plus"
            onPress={() => setRequired((v) => Math.min(999, v + 1))}
            style={styles.stepBtn}
          >
            <Ionicons name="add" size={24} color={colors.brandPrimary} />
          </Pressable>
        </View>

        <AppButton
          testID="save-competition"
          title={isEdit ? "Salva modifiche" : "Crea gara"}
          onPress={onSubmit}
          loading={save.isPending}
          icon="checkmark"
          style={{ marginTop: spacing.lg }}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface },
  notes: { height: 100, paddingTop: spacing.md, textAlignVertical: "top" },
  stepLabel: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
    marginBottom: spacing.xs,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValueBox: { alignItems: "center" },
  stepValue: { fontSize: 28, fontWeight: "900", color: colors.brandPrimary },
  stepHint: { fontSize: fontSize.sm, color: colors.muted, fontWeight: "600" },
}));
