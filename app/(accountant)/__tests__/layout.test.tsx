import { Tabs } from "expo-router";
import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AccountantTabsLayout from "../_layout";

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

// `app/(accountant)/mukellef/` has no `_layout.tsx` of its own, so
// expo-router hoists every file under it into this group's own screen list
// (see `getRoutesCore.js`: "Routes in directories without _layout files are
// hoisted to the nearest _layout" / "The name of the route is relative to
// the nearest _layout"), named by their path relative to `(accountant)/`
// with extensions stripped: `mukellef/[clientId].tsx`,
// `mukellef/[clientId]/kamera.tsx`, and `mukellef/[clientId]/fis/[id].tsx`
// become these three route names.
const HIDDEN_ROUTES = ["mukellef/[clientId]", "mukellef/[clientId]/kamera", "mukellef/[clientId]/fis/[id]"];

test("registers every route in the group, hiding the ones that are not tabs", () => {
  renderLayout();
  const screens = screen.UNSAFE_getAllByType(Tabs.Screen);
  const names = screens.map((s) => s.props.name);

  for (const hidden of HIDDEN_ROUTES) {
    expect(names).toContain(hidden);
  }

  const hiddenScreens = screens.filter((s) => HIDDEN_ROUTES.includes(s.props.name));
  expect(hiddenScreens).toHaveLength(HIDDEN_ROUTES.length);
  for (const s of hiddenScreens) {
    expect(s.props.options?.href).toBeNull();
  }

  const visibleScreens = screens.filter((s) => !HIDDEN_ROUTES.includes(s.props.name));
  expect(visibleScreens).toHaveLength(3);
  for (const s of visibleScreens) {
    expect(s.props.options?.href).not.toBeNull();
  }
});
