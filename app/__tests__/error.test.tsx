import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { ErrorBoundary } from "../_layout";

/**
 * `app/+error.tsx` is not a valid file name in this expo-router version
 * (~57.0.11): `getRoutesCore.js` throws "Route nodes cannot start with the
 * '+' character" for any `+`-prefixed file other than `+not-found` — see
 * task-27-report.md for how this was confirmed. The router's real
 * convention for a route-wide crash boundary is a named `ErrorBoundary`
 * export from the route file itself, so the root layout (`app/_layout.tsx`,
 * which wraps every screen via `<Slot />`) exports one instead. This test
 * exercises that export directly rather than a `+error.tsx` module.
 *
 * Importing `../_layout` runs every top-level import in that file (fonts,
 * auth, the upload worker, react-query) even though only the named
 * `ErrorBoundary` export is used below, so all of those need stubs the same
 * way a real render of `<RootLayout />` would need them.
 */
jest.mock("expo-router", () => ({
  Slot: () => null,
  SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
  router: { replace: jest.fn() },
}));
jest.mock("expo-font", () => ({ useFonts: () => [true] }));
jest.mock("@expo-google-fonts/plus-jakarta-sans", () => ({
  PlusJakartaSans_400Regular: "PlusJakartaSans_400Regular",
  PlusJakartaSans_500Medium: "PlusJakartaSans_500Medium",
  PlusJakartaSans_700Bold: "PlusJakartaSans_700Bold",
  PlusJakartaSans_800ExtraBold: "PlusJakartaSans_800ExtraBold",
}));
jest.mock("@/src/auth/AuthProvider", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock("@/src/upload/worker", () => ({ startWorker: () => () => {} }));
jest.mock("@/src/upload/invalidateAfterUpload", () => ({ invalidateAfterUpload: jest.fn() }));

test("renders the crash copy and calls retry", () => {
  const retry = jest.fn().mockResolvedValue(undefined);
  render(<ErrorBoundary error={new Error("boom")} retry={retry} />);

  expect(screen.getByText("Bir şeyler ters gitti")).toBeOnTheScreen();
  fireEvent.press(screen.getByText("Tekrar dene"));
  expect(retry).toHaveBeenCalledTimes(1);
});
