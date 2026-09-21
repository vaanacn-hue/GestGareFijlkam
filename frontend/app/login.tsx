import React, { useRef, useState } from "react";
import {
  Animated,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme } from "@/src/theme";
import { spacing, fontSize, radius, images } from "@/src/tokens";
import { AppButton, TextField } from "@/src/components/ui";
import { useAuth } from "@/src/auth/AuthContext";
import { ApiError } from "@/src/api/client";

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const onSubmit = async () => {
    if (!username.trim() || !password) {
      setError("Inserisci username e password");
      triggerShake();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const user = await signIn(username.trim(), password);
      if (user.role === "master") router.replace("/(master)");
      else router.replace("/(official)");
    } catch (e) {
      setError((e as ApiError).detail || "Accesso non riuscito");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={{ uri: images.authBackground }} style={styles.bg}>
      <LinearGradient
        colors={["rgba(11,22,44,0.55)", "rgba(11,22,44,0.85)", colors.surface]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.brandBlock, { paddingTop: insets.top + spacing["3xl"] }]}>
          <View style={styles.logo}>
            <Ionicons name="shield-checkmark" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.appName}>GaraMaster</Text>
          <Text style={styles.tagline}>Gestione presenze ufficiali di gara</Text>
        </View>

        <View style={styles.spacer} />

        <Animated.View
          style={[
            styles.card,
            { paddingBottom: insets.bottom + spacing.xl, transform: [{ translateX: shake }] },
          ]}
        >
          <Text style={styles.cardTitle}>Accedi</Text>
          <Text style={styles.cardSub}>Inserisci le tue credenziali per continuare</Text>

          <Image
            source={require("../assets/images/fijlkam-logo.png")}
            style={styles.logoImg}
            contentFit="contain"
            testID="fijlkam-logo"
          />

          <TextField
            testID="login-username"
            label="Username"
            placeholder="es. m.rossi"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
          <TextField
            testID="login-password"
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error ? (
            <View style={styles.errorRow} testID="login-error">
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <AppButton
            testID="login-submit"
            title="Accedi"
            onPress={onSubmit}
            loading={loading}
            icon="log-in-outline"
            style={{ marginTop: spacing.sm }}
          />
        </Animated.View>
      </KeyboardAwareScrollView>
    </ImageBackground>
  );
}

const useStyles = makeStyles((colors) => ({
  bg: { flex: 1, backgroundColor: colors.brand },
  brandBlock: { alignItems: "center", paddingHorizontal: spacing.xl, gap: spacing.xs },
  logo: {
    width: 84,
    height: 84,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  appName: { fontSize: 34, fontWeight: "900", color: "#FFFFFF", letterSpacing: 0.5 },
  tagline: { fontSize: fontSize.base, color: "rgba(255,255,255,0.85)", fontWeight: "500" },
  spacer: { flex: 1, minHeight: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.xs,
  },
  cardTitle: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface },
  cardSub: { fontSize: fontSize.base, color: colors.muted, marginBottom: spacing.md },
  logoImg: { width: "100%", height: 64, marginBottom: spacing.lg },
  errorRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  errorText: { color: colors.error, fontSize: fontSize.base, fontWeight: "600", flexShrink: 1 },
}));
