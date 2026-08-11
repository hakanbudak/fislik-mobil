import { Tabs } from "expo-router";
import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ClientTabsLayout from "../_layout";

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
// call `useSafeAreaInsets()` outside the app's real root.
const metrics = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 34 },
};

function renderLayout() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ClientTabsLayout />
    </SafeAreaProvider>,
  );
}

const HIDDEN_ROUTES = ["kamera", "firma-bilgileri", "fis/[id]"];

test("registers every route in the group, hiding the ones that are not tabs", () => {
  renderLayout();
  const screens = screen.UNSAFE_getAllByType(Tabs.Screen);
  const names = screens.map((s) => s.props.name);

  for (const hidden of HIDDEN_ROUTES) {
    expect(names).toContain(hidden);
  }

  // Each hidden route must carry href: null so it never renders in the bar.
  const hiddenScreens = screens.filter((s) => HIDDEN_ROUTES.includes(s.props.name));
  expect(hiddenScreens).toHaveLength(HIDDEN_ROUTES.length);
  for (const s of hiddenScreens) {
    expect(s.props.options?.href).toBeNull();
  }

  // The tab-bar-visible routes must NOT carry href: null.
  const visibleScreens = screens.filter((s) => !HIDDEN_ROUTES.includes(s.props.name));
  expect(visibleScreens).toHaveLength(4);
  for (const s of visibleScreens) {
    expect(s.props.options?.href).not.toBeNull();
  }
});
