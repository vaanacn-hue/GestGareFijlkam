import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/Toast";
import { AuthProvider } from "@/src/auth/AuthContext";
import { queryClient } from "@/src/query-client";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <KeyboardProvider>
              <AuthProvider>
                <ToastProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="login" />
                    <Stack.Screen name="(master)" />
                    <Stack.Screen name="(official)" />
                    <Stack.Screen
                      name="official-form"
                      options={{ presentation: "modal" }}
                    />
                    <Stack.Screen
                      name="competition-form"
                      options={{ presentation: "modal" }}
                    />
                    <Stack.Screen name="settings" options={{ presentation: "modal" }} />
                    <Stack.Screen name="competition/[id]" />
                  </Stack>
                </ToastProvider>
              </AuthProvider>
            </KeyboardProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
