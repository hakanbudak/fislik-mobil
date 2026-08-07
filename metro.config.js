const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Mirror the "@/*" -> "./*" path alias declared in tsconfig.json so Metro
// (not just Jest's moduleNameMapper) can resolve `@/...` imports at
// bundle time. See task-2-report.md for verification.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@": path.resolve(__dirname),
};

module.exports = config;
