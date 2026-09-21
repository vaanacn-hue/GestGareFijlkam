import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme } from "@/src/theme";
import { spacing, fontSize, radius } from "@/src/tokens";
import { api, AppUser, ApiError } from "@/src/api/client";
import { AppButton, TextField } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";

function buildUsername(first: string, surname: string) {
  const fn = first.trim();
  const sn = surname.trim().toLowerCase().replace(/\s/g, "");
  if (!fn || !sn) return "";
  return `${fn[0].toLowerCase()}.${sn}`;
}

export default function OfficialForm() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const { data: officials } = useQuery({
    queryKey: ["officials"],
    queryFn: () => api.get<AppUser[]>("/officials"),
    enabled: isEdit,
  });
  const editing = useMemo(
    () => officials?.find((o) => o.id === id),
    [officials, id],
  );

  const [first, setFirst] = useState("");
  const [surname, setSurname] = useState("");
  const [password, setPassword] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [errors, setErrors] = useState<{ first?: string; surname?: string; password?: string }>({});

  if (isEdit && editing && !hydrated) {
    setFirst(editing.first_name);
    setSurname(editing.surname);
    setHydrated(true);
  }

  const username = buildUsername(first, surname);

  const save = useMutation({
    mutationFn: () => {
      if (isEdit) {
        const body: Record<string, unknown> = { first_name: first.trim(), surname: surname.trim() };
        if (password) body.password = password;
        return api.patch(`/officials/${id}`, body);
      }
      return api.post("/officials", {
        first_name: first.trim(),
        surname: surname.trim(),
        password,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["officials"] });
      toast.show(isEdit ? "Ufficiale aggiornato" : `Creato @${username}`, "success");
      router.back();
    },
    onError: (e: ApiError) => toast.show(e.detail, "error"),
  });

  const onSubmit = () => {
    const errs: typeof errors = {};
    if (!first.trim()) errs.first = "Obbligatorio";
    if (!surname.trim()) errs.surname = "Obbligatorio";
    if (!isEdit && password.length < 4) errs.password = "Almeno 4 caratteri";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    save.mutate();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>{isEdit ? "Modifica ufficiale" : "Nuovo ufficiale"}</Text>
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
          testID="official-first"
          label="Nome"
          placeholder="Mario"
          value={first}
          onChangeText={setFirst}
          error={errors.first}
        />
        <TextField
          testID="official-surname"
          label="Cognome"
          placeholder="Rossi"
          value={surname}
          onChangeText={setSurname}
          error={errors.surname}
        />

        {username ? (
          <View style={styles.previewBox} testID="username-preview">
            <Ionicons name="at" size={18} color={colors.brandPrimary} />
            <Text style={styles.previewText}>
              Username: <Text style={styles.previewName}>{username}</Text>
            </Text>
          </View>
        ) : null}

        <View style={{ height: spacing.md }} />

        <TextField
          testID="official-password"
          label={isEdit ? "Nuova password (opzionale)" : "Password"}
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          error={errors.password}
        />

        <AppButton
          testID="save-official"
          title={isEdit ? "Salva modifiche" : "Crea ufficiale"}
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
  previewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandTertiary,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  previewText: { fontSize: fontSize.base, color: colors.onBrandTertiary },
  previewName: { fontWeight: "800" },
}));
