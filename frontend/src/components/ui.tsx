import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import Ionicons from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { radius, spacing, fontSize } from "@/src/tokens";

// -------------------------------------------------------------- Button
type BtnVariant = "primary" | "secondary" | "outline" | "danger" | "success";
export function AppButton({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  testID,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: BtnVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const bg = {
    primary: colors.brandPrimary,
    secondary: colors.brandTertiary,
    outline: "transparent",
    danger: colors.error,
    success: colors.success,
  }[variant];
  const fg = {
    primary: colors.onBrandPrimary,
    secondary: colors.onBrandTertiary,
    outline: colors.brandPrimary,
    danger: colors.onError,
    success: colors.onSuccess,
  }[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      disabled={isDisabled}
      onPress={() => {
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === "outline" && { borderWidth: 1.5, borderColor: colors.brandPrimary },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Ionicons name={icon as any} size={18} color={fg} /> : null}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// -------------------------------------------------------------- TextField
export function TextField({
  label,
  error,
  testID,
  ...props
}: TextInputProps & { label?: string; error?: string; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        testID={testID}
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? { borderColor: colors.error } : null]}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// -------------------------------------------------------------- Card
export function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

// -------------------------------------------------------------- Badge
export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "error" | "info" | "brand";
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const map = {
    neutral: { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary },
    success: { bg: colors.success, fg: colors.onSuccess },
    warning: { bg: colors.warning, fg: colors.onWarning },
    error: { bg: colors.error, fg: colors.onError },
    info: { bg: colors.info, fg: colors.onInfo },
    brand: { bg: colors.brandTertiary, fg: colors.onBrandTertiary },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Text style={[styles.badgeText, { color: map.fg }]}>{label}</Text>
    </View>
  );
}

// -------------------------------------------------------------- EmptyState
export function EmptyState({
  icon = "file-tray-outline",
  title,
  subtitle,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon as any} size={34} color={colors.brandPrimary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

// -------------------------------------------------------------- SectionHeader
export function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  btn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btnText: { fontSize: fontSize.lg, fontWeight: "700" },
  fieldWrap: { gap: spacing.xs, marginBottom: spacing.md },
  label: { fontSize: fontSize.base, fontWeight: "600", color: colors.onSurfaceSecondary },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.lg,
    color: colors.onSurface,
  },
  errorText: { color: colors.error, fontSize: fontSize.sm, fontWeight: "500" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#0B162C",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: fontSize.sm, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: spacing["2xl"], gap: spacing.sm },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface },
  emptySub: {
    fontSize: fontSize.base,
    color: colors.muted,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface },
}));
