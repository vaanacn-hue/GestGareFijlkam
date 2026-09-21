import React, { useState, useMemo } from "react";
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme } from "@/src/theme";
import { spacing, fontSize, radius } from "@/src/tokens";
import { api, AppUser, ApiError } from "@/src/api/client";
import { usesNativeTabs } from "@/src/navigation";
import { Card, EmptyState, Badge } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";

export default function Officials() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["officials"],
    queryFn: () => api.get<AppUser[]>("/officials"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter(
      (o) =>
        `${o.first_name} ${o.surname}`.toLowerCase().includes(q) ||
        o.username.toLowerCase().includes(q),
    );
  }, [data, search]);

  const toggleActive = useMutation({
    mutationFn: (o: AppUser) => api.patch(`/officials/${o.id}`, { active: !o.active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["officials"] });
      toast.show("Ufficiale aggiornato", "success");
    },
    onError: (e: ApiError) => toast.show(e.detail, "error"),
  });

  const removeOfficial = useMutation({
    mutationFn: (o: AppUser) => api.del(`/officials/${o.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["officials"] });
      toast.show("Ufficiale eliminato", "success");
    },
    onError: (e: ApiError) => toast.show(e.detail, "error"),
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>Ufficiali</Text>
        <Pressable
          testID="add-official-header"
          onPress={() => router.push("/official-form")}
          style={styles.addBtn}
          hitSlop={8}
        >
          <Ionicons name="add" size={26} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            testID="search-officials"
            placeholder="Cerca ufficiale..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            autoCapitalize="none"
          />
          {search ? (
            <Pressable testID="clear-search" onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + 96, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="people-outline"
                title={search ? "Nessun risultato" : "Nessun ufficiale"}
                subtitle={
                  search
                    ? "Prova con un altro nome o username."
                    : "Aggiungi gli ufficiali di gara. Lo username sarà m.cognome."
                }
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item.first_name[0] ?? "").toUpperCase()}
                {(item.surname[0] ?? "").toUpperCase()}
              </Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {item.first_name} {item.surname}
              </Text>
              <Text style={styles.username}>@{item.username}</Text>
              {!item.active && <Badge label="Disattivato" tone="error" />}
            </View>
            <View style={styles.actions}>
              <Pressable
                testID={`edit-official-${item.id}`}
                onPress={() =>
                  router.push({ pathname: "/official-form", params: { id: item.id } })
                }
                hitSlop={8}
                style={styles.iconBtn}
              >
                <Ionicons name="create-outline" size={22} color={colors.brandPrimary} />
              </Pressable>
              <Pressable
                testID={`toggle-official-${item.id}`}
                onPress={() => toggleActive.mutate(item)}
                hitSlop={8}
                style={styles.iconBtn}
              >
                <Ionicons
                  name={item.active ? "pause-circle-outline" : "play-circle-outline"}
                  size={22}
                  color={item.active ? colors.warning : colors.success}
                />
              </Pressable>
              <Pressable
                testID={`delete-official-${item.id}`}
                onPress={() => removeOfficial.mutate(item)}
                hitSlop={8}
                style={styles.iconBtn}
              >
                <Ionicons name="trash-outline" size={21} color={colors.error} />
              </Pressable>
            </View>
          </Card>
        )}
      />

      <Pressable
        testID="add-official-fab"
        onPress={() => router.push("/official-form")}
        style={[styles.fab, { bottom: bottomChrome + 16 }]}
      >
        <Ionicons name="person-add" size={24} color={colors.onBrandPrimary} />
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
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, fontSize: fontSize.base, color: colors.onSurface, paddingVertical: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: fontSize.lg, fontWeight: "800", color: colors.brandPrimary },
  info: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface },
  username: { fontSize: fontSize.base, color: colors.muted },
  actions: { flexDirection: "row", gap: spacing.xs },
  iconBtn: { width: 34, height: 38, alignItems: "center", justifyContent: "center" },
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
