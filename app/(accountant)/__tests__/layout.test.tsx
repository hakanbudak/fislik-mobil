/// <reference types="node" />
import path from "node:path";
import { Tabs } from "expo-router";
import { render, screen } from "@testing-library/react-native";
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

const metrics = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 34 },
};

function renderLayout() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AccountantTabsLayout />
    </SafeAreaProvider>,
  );
}

const VISIBLE_ROUTES = ["index", "bildirimler", "profil"];
// `app/(accountant)/mukellef/` has no `_layout.tsx` of its own, so
// expo-router hoists every file under it into this group's own screen list
// (see `getRoutesCore.js`: routes in a directory without `_layout` are
// hoisted to the nearest one, named by their path relative to it). The
// exact names below are asserted against expo-router's real `getRoutes()`
// output below, not just assumed.
const HIDDEN_ROUTES = [
  "mukellef/[clientId]",
  "mukellef/[clientId]/kamera",
  "mukellef/[clientId]/fis/[id]",
  "yardim",
];

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
