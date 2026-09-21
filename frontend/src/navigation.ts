import { Platform } from "react-native";

// True only on iOS 26+, where expo-router native tabs (Liquid Glass) are used.
// Everywhere else (older iOS, Android, web) the classic JS <Tabs> is used.
export const usesNativeTabs =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
