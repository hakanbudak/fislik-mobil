import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppHeader } from "../AppHeader";

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };

test("renders the brand", () => {
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppHeader />
    </SafeAreaProvider>,
  );
  expect(screen.getByText("Fişlik")).toBeOnTheScreen();
});

test("does not duplicate the notifications entry from the tab bar", () => {
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppHeader />
    </SafeAreaProvider>,
  );
  expect(screen.queryByLabelText("Bildirimler")).toBeNull();
});
