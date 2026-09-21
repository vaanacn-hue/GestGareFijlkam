import React, { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";
import { spacing, fontSize, radius } from "@/src/tokens";
import { formatDate } from "@/src/utils/date";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toISO(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export function DatePickerField({
  label,
  value,
  onChange,
  error,
  testID,
  placeholder = "Seleziona data",
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
  testID?: string;
  placeholder?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const initial = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T00:00:00") : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const openPicker = () => {
    const d = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T00:00:00") : new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setOpen(true);
  };

  // build grid: leading blanks (Mon=0)
  const firstDay = new Date(viewYear, viewMonth, 1);
  const jsDow = firstDay.getDay(); // 0=Sun
  const lead = (jsDow + 6) % 7; // Mon-first offset
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const select = (d: number) => {
    onChange(toISO(viewYear, viewMonth, d));
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        testID={testID}
        onPress={openPicker}
        style={[styles.field, error ? { borderColor: colors.error } : null]}
      >
        <Ionicons name="calendar-outline" size={20} color={colors.brandPrimary} />
        <Text style={[styles.value, !value && { color: colors.muted }]}>
          {value ? formatDate(value) : placeholder}
        </Text>
        {value ? (
          <Pressable
            testID={`${testID}-clear`}
            onPress={() => onChange("")}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.calHeader}>
              <Pressable testID="cal-prev" onPress={prevMonth} style={styles.navBtn} hitSlop={8}>
                <Ionicons name="chevron-back" size={22} color={colors.brandPrimary} />
              </Pressable>
              <Text style={styles.calTitle}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <Pressable testID="cal-next" onPress={nextMonth} style={styles.navBtn} hitSlop={8}>
                <Ionicons name="chevron-forward" size={22} color={colors.brandPrimary} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={styles.weekday}>
                  {w}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((d, i) => {
                const iso = d ? toISO(viewYear, viewMonth, d) : "";
                const selected = d && iso === value;
                return (
                  <View key={i} style={styles.cell}>
                    {d ? (
                      <Pressable
                        testID={`cal-day-${d}`}
                        onPress={() => select(d)}
                        style={[styles.day, selected && styles.daySelected]}
                      >
                        <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{d}</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.day} />
                    )}
                  </View>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { gap: spacing.xs, marginBottom: spacing.md },
  label: { fontSize: fontSize.base, fontWeight: "600", color: colors.onSurfaceSecondary },
  field: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  value: { flex: 1, fontSize: fontSize.lg, color: colors.onSurface },
  errorText: { color: colors.error, fontSize: fontSize.sm, fontWeight: "500" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(11,22,44,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  calTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface },
  weekRow: { flexDirection: "row" },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  day: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  daySelected: { backgroundColor: colors.brandPrimary },
  dayText: { fontSize: fontSize.base, fontWeight: "600", color: colors.onSurface },
  dayTextSelected: { color: colors.onBrandPrimary, fontWeight: "800" },
}));
