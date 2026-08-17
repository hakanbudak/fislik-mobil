/// <reference types="node" />
import path from "node:path";
import { router, Tabs } from "expo-router";
import { fireEvent, render, screen } from "@testing-library/react-native";
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
// tree inspected with RNTL's `UNSAFE_getAllByType`. `router.push` is mocked
// too — the raised camera button (rendered as a sibling of `<Tabs>`, not a
// child of it) calls it directly and isn't affected by the `Tabs`/`Tabs.Screen`
// stand-ins above.
jest.mock("expo-router", () => {
  const React = require("react");
  const Tabs = ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  Tabs.Screen = () => null;
  return { Tabs, router: { push: jest.fn() } };
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

const VISIBLE_ROUTES = ["index", "muhasebecim", "kamera", "bildirimler", "profil"];
// `fis` is the receipt-detail subtree, registered as one entry because
// `app/(client)/fis/_layout.tsx` (a `Stack`) owns `[id]` itself — not the
// flat `fis/[id]` tab screen it used to be, which never re-mounted between
// receipts. See that layout for the bug that caused.
const HIDDEN_ROUTES = ["firma-bilgileri", "fis", "yardim"];

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
  // The shell `View` is outermost, so it's first in the (pre-order) tree —
  // `getAllByType` rather than `getByType` because the raised camera
  // button's overlay wrapper is also a plain `View` and would otherwise
  // make this ambiguous.
  const outerView = screen.UNSAFE_getAllByType(View)[0];
  const outerStyle = Object.assign({}, ...[outerView.props.style].flat());
  expect(outerStyle.paddingTop).toBe(59);

  const tabBarStyle = screen.UNSAFE_getByType(Tabs).props.screenOptions.tabBarStyle;
  expect(tabBarStyle.paddingBottom).toBe(10 + 34);
  expect(tabBarStyle.height).toBe(56 + 34);
});

test("registers kamera as the middle tab, with an empty non-interactive slot in the bar", () => {
  renderLayout();
  const screens = screen.UNSAFE_getAllByType(Tabs.Screen);
  const names = screens.map((s) => s.props.name);
  expect(names.indexOf("kamera")).toBe(2);
  expect(names).toEqual(["index", "muhasebecim", "kamera", "bildirimler", "profil", "firma-bilgileri", "fis", "yardim"]);

  // The reserved slot must render as an inert `View`, not a pressable
  // control — the tappable button lives in the overlay, not the bar.
  const kameraScreen = screens.find((s) => s.props.name === "kamera");
  const slot = kameraScreen?.props.options?.tabBarButton?.({});
  expect(slot?.type).toBe(View);
  expect(slot?.props.style).toEqual({ flex: 1 });
});

test("positions the raised camera button so it straddles the bar's top edge, half inside and half outside it", () => {
  renderLayout();
  // Bar height is 56 + insets.bottom (34) = 90. The button (56pt) should sit
  // with its vertical centre on the bar's top edge, i.e. its bottom offset
  // from the shell's bottom edge is barHeight - buttonSize / 2 = 90 - 28 = 62.
  const overlay = screen.getByTestId("camera-button-overlay");
  const overlayStyle = Object.assign({}, ...[overlay.props.style].flat());
  expect(overlayStyle.bottom).toBe(62);
});

test("the raised camera button navigates to the camera route", () => {
  renderLayout();
  fireEvent.press(screen.getByLabelText("Fiş çek"));
  expect(router.push).toHaveBeenCalledWith("/(client)/kamera");
});
