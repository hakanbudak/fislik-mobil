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
        // `image` points at a 1x1 fully-transparent PNG, not the old
        // branded mark. The JS splash overlay (SplashOverlay) draws the
        // mark itself, "printing" it in from above a slot — a *visible*
        // native splash image (the old `assets/splash.png`, teal mark on
        // transparent) would flash in statically, vanish when the JS
        // overlay mounts, then re-print, breaking the seamless handover
        // the design calls for. A transparent image reveals nothing but
        // `backgroundColor`, matching the overlay's pre-print frame.
        //
        // An *absent* `image` was tried first and is broken on Android:
        // `expo-splash-screen`'s config plugin unconditionally points the
        // Android 12+ `windowSplashScreenAnimatedIcon` style attribute at
        // `@drawable/splashscreen_logo` (see its `withAndroidSplashStyles`
        // module), but only *generates* that drawable when `image` is set
        // (`withAndroidSplashImages`'s per-density loop is a no-op
        // otherwise). Confirmed by running `expo prebuild --platform
        // android` with `image` omitted: no `splashscreen_logo` resource
        // is written anywhere under `android/app/src/main/res`, while
        // `styles.xml` still references it — a dangling resource that
        // aapt2 fails to link at Android build time. A transparent image
        // keeps the resource real while staying invisible.
        image: "./assets/splash-blank.png",
        imageWidth: 1,
        resizeMode: "cover",
        backgroundColor: "#0f766e",
      },
    ],
  ],
  extra: { apiUrl: process.env.EXPO_PUBLIC_API_URL },
};

export default config;
