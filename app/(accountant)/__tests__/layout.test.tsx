/// <reference types="node" />
import path from "node:path";
import { Tabs } from "expo-router";
import { render, screen } from "@testing-library/react-native";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AccountantTabsLayout from "../_layout";
import { registeredRouteNames } from "@/src/test/expoRouterRegistry";

// See app/(client)/__tests__/layout.test.tsx for why `<Tabs>`/`<Tabs.Screen>`
// are replaced with passthrough stand-ins rather than rendering the real
// expo-router navigator in isolation.
jest.mock("expo-router", () => {
  const React = require("react");
  const Tabs = ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  Tabs.Screen = () => null;
  return { Tabs };
});

jest.mock("@/src/auth/AuthProvider", () => ({
  useAuth: () => ({ user: null, signOut: jest.fn() }),
}));

// Non-zero on both edges (iPhone 15 Pro-shaped) — see
// app/(client)/__tests__/layout.test.tsx for why a `top: 0` metric would let
// this suite pass whether or not the shell applies `insets.top` at all.
const metrics = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

function renderLayout() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AccountantTabsLayout />
    </SafeAreaProvider>,
  );
}

const VISIBLE_ROUTES = ["index", "bildirimler", "profil"];
// `mukellef` is ONE entry, not three: `app/(accountant)/mukellef/_layout.tsx`
// (a `Stack`) owns `[clientId]`, `[clientId]/kamera` and `[clientId]/fis/[id]`
// itself, so expo-router stops hoisting at it (see `getRoutesCore.js`: routes
// are hoisted to the nearest ancestor `_layout`). Before that file existed all
// three were flat tab screens — single persistent instances that never
// re-mounted, which is what made the receipt-detail screen render the
// previously-opened receipt's state. The exact names below are asserted
// against expo-router's real `getRoutes()` output below, not just assumed.
const HIDDEN_ROUTES = ["mukellef", "mukellefleri-yonet", "yardim"];

test("every route expo-router registers for this group is either an intended tab or hidden with href: null", () => {
  // Derived from the real on-disk files in `app/(accountant)/` via
  // expo-router's own `getRoutes()` — not from a hand-typed list — so a
  // renamed file or a wrong hidden-route name shows up here as a mismatch,
  // instead of two hand-typed strings silently agreeing with each other.
  const registered = registeredRouteNames(path.join(__dirname, ".."));
  expect(new Set(registered)).toEqual(new Set([...VISIBLE_ROUTES, ...HIDDEN_ROUTES]));

  renderLayout();
  const screens = screen.UNSAFE_getAllByType(Tabs.Screen);
  const byName = new Map(screens.map((s) => [s.props.name, s]));

  for (const routeName of registered) {
    const screenElement = byName.get(routeName);
    expect(screenElement).toBeDefined();
    if (HIDDEN_ROUTES.includes(routeName)) {
      expect(screenElement?.props.options?.href).toBeNull();
    } else {
      expect(screenElement?.props.options?.href).not.toBeNull();
    }
  }
});

test("pads the outer view for the top inset and folds the bottom inset into the tab bar, so no content sits under the notch or the home indicator", () => {
  renderLayout();
  const outerView = screen.UNSAFE_getByType(View);
  const outerStyle = Object.assign({}, ...[outerView.props.style].flat());
  expect(outerStyle.paddingTop).toBe(59);

  const tabBarStyle = screen.UNSAFE_getByType(Tabs).props.screenOptions.tabBarStyle;
  expect(tabBarStyle.paddingBottom).toBe(10 + 34);
  expect(tabBarStyle.height).toBe(56 + 34);
});
