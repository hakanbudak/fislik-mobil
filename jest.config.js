const jestExpoPreset = require("jest-expo/jest-preset");

module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|lucide-react-native))",
    "/node_modules/react-native-reanimated/plugin/",
    "/node_modules/@react-native/babel-preset/",
  ],
  // lucide-react-native ships an ESM (.mjs) entrypoint; extend the preset's
  // transform map so babel-jest also handles that extension.
  transform: {
    ...jestExpoPreset.transform,
    "^.+\\.mjs$": jestExpoPreset.transform["\\.[jt]sx?$"],
  },
};
