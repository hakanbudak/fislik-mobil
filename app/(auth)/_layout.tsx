import { Stack } from "expo-router";

/** Unauthenticated group: login, register and password reset. Each screen
 *  builds its own chrome via `AuthShell`, so the stack itself is headerless. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
