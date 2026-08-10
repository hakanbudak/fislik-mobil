const jestExpoPreset = require("jest-expo/jest-preset");

module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // The RN Jest environment resolves package "exports" maps with
    // ['require', 'react-native'] conditions only. msw's "./node" subpath
    // marks "react-native" as `null` (explicitly unexported for that
    // condition) with no matching "require" branch either, so Jest can't
    // resolve "msw/node" at all under those conditions. Point both entry
    // points straight at their compiled CJS files to sidestep exports-map
    // resolution entirely.
    "^msw/node$": "<rootDir>/node_modules/msw/lib/node/index.js",
    "^msw$": "<rootDir>/node_modules/msw/lib/core/index.js",
  },
  transformIgnorePatterns: [
    // msw (used only by contract tests, see src/api/__tests__/) pulls in a
    // chain of ESM-only transitive dependencies (no CJS build) — they need
    // babel-jest same as the RN packages above, or requiring them throws
    // "Cannot use import statement outside a module" / "Unexpected token
    // 'export'".
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|lucide-react-native|rettime|@open-draft|@mswjs|headers-polyfill|outvariant|is-node-process|strict-event-emitter|until-async))",
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
