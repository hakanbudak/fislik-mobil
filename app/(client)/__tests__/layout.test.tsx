/// <reference types="node" />
import path from "node:path";
import { Tabs } from "expo-router";
import { render, screen } from "@testing-library/react-native";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ClientTabsLayout from "../_layout";
import { registeredRouteNames } from "@/src/test/expoRouterRegistry";

// `<Tabs>` from expo-router needs a real router context (it reads the
// current route's filename via `useContextKey`) that only exists once the
// app is mounted through expo-router's own root — not available to a
// component rendered in isolation here. Since the goal is to inspect the
// screen configuration this layout declares (which routes exist, which
// carry `href: null`, what styling `screenOptions` passes down) rather than
// to exercise real tab navigation, `<Tabs>`/`<Tabs.Screen>` are replaced
// with passthrough stand-ins that keep the same prop shape so the real
// (unmocked) `ClientTabsLayout` component can be rendered and its element
// tree inspected with RNTL's `UNSAFE_getAllByType`.
jest.mock("expo-router", () => {
  const React = require("react");
  const Tabs = ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  Tabs.Screen = () => null;
  return { Tabs };
});

jest.mock("@/src/auth/AuthProvider", () => ({
  useAuth: () => ({ user: null, signOut: jest.fn() }),
}));

// Matches this repo's `initialMetrics` shape for testing components that
// call `useSafeAreaInsets()` outside the app's real root. Both insets are
// non-zero (iPhone 15 Pro-shaped) so a test asserting against them can
// actually fail if the padding that consumes them is deleted — a `top: 0`
// metric made the previous version of this suite pass whether or not the
// shell applied `insets.top` at all.
const metrics = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

function renderLayout() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ClientTabsLayout />
    </SafeAreaProvider>,
  );
}

const VISIBLE_ROUTES = ["index", "muhasebecim", "bildirimler", "profil"];
const HIDDEN_ROUTES = ["kamera", "firma-bilgileri", "fis/[id]", "yardim"];

test("every route expo-router registers for this group is either an intended tab or hidden with href: null", () => {
  // Derived from the real on-disk files in `app/(client)/` via expo-router's
  // own `getRoutes()` — not from a hand-typed list — so a renamed file or a
  // wrong hidden-route name shows up here as a mismatch, instead of two
  // hand-typed strings silently agreeing with each other.
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
