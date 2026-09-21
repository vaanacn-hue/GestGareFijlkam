import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme } from "@/src/theme";
import { spacing, fontSize } from "@/src/tokens";
import { api, ApiError } from "@/src/api/client";
import { AppButton, TextField } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";

type Comp = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  address: string;
  notes: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// auto-format digits into YYYY-MM-DD
function maskDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  let out = digits.slice(0, 4);
  if (digits.length > 4) out += "-" + digits.slice(4, 6);
  if (digits.length > 6) out += "-" + digits.slice(6, 8);
  return out;
}

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
        <TextField
          testID="comp-start"
          label="Data inizio"
          placeholder="AAAA-MM-GG"
          keyboardType="number-pad"
          value={start}
          onChangeText={(v) => setStart(maskDate(v))}
          error={errors.start}
        />
        <TextField
          testID="comp-end"
          label="Data fine (opzionale)"
          placeholder="AAAA-MM-GG"
          keyboardType="number-pad"
          value={end}
          onChangeText={(v) => setEnd(maskDate(v))}
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

        <AppButton
          testID="save-competition"
          title={isEdit ? "Salva modifiche" : "Crea gara"}
          onPress={onSubmit}
          loading={save.isPending}
          icon="checkmark"
          style={{ marginTop: spacing.md }}
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
}));
