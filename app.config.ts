import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Fişlik",
  slug: "fislik",
  scheme: "fislik",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: { bundleIdentifier: "dev.selamet.fislik", supportsTablet: false },
  android: { package: "dev.selamet.fislik" },
  plugins: ["expo-router"],
  extra: { apiUrl: process.env.EXPO_PUBLIC_API_URL },
};

export default config;
