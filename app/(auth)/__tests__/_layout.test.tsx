import { render, screen } from "@testing-library/react-native";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthLayout from "../_layout";

// `<Stack>` needs a real router context to mount, which isn't available to a
// component rendered in isolation here — see app/(client)/__tests__/layout.test.tsx
// for the same reasoning. A passthrough stand-in lets the real (unmocked)
// `AuthLayout` component render and its wrapping `View`'s style be inspected.
jest.mock("expo-router", () => {
  const React = require("react");
  const Stack = () => React.createElement(React.Fragment, null);
  return { Stack };
});

const metrics = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

function renderLayout() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AuthLayout />
    </SafeAreaProvider>,
  );
}

test("pads the auth group's outer view for both the top and bottom insets, so no auth screen sits under the notch or the home indicator", () => {
  renderLayout();
  const outerView = screen.UNSAFE_getByType(View);
  const merged = Object.assign({}, ...[outerView.props.style].flat());
  expect(merged.paddingTop).toBe(59);
  expect(merged.paddingBottom).toBe(34);
});
