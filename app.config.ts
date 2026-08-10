import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Fişlik",
  slug: "fislik",
  scheme: "fislik",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  ios: {
    bundleIdentifier: "dev.selamet.fislik",
    supportsTablet: false,
    associatedDomains: ["applinks:fislik.selamet.dev"],
    infoPlist: {
      NSFaceIDUsageDescription:
        "Fişlik'i Face ID ile hızlıca açabilmeniz için kullanılır.",
    },
  },
  android: {
    package: "dev.selamet.fislik",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0f766e",
    },
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "fislik.selamet.dev", pathPrefix: "/davet" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "fislik.selamet.dev", pathPrefix: "/sifre-sifirla" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-secure-store",
    ["expo-camera", { cameraPermission: "Fişlerinizi fotoğraflamak için kamera erişimi gerekiyor." }],
    ["expo-image-picker", { photosPermission: "Galerinizden fiş seçebilmek için fotoğraf erişimi gerekiyor." }],
    "expo-sharing",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#e9eeed",
      },
    ],
  ],
  extra: { apiUrl: process.env.EXPO_PUBLIC_API_URL },
};

export default config;
