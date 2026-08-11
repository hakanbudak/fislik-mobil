import { fireEvent, render, screen } from "@testing-library/react-native";
import { Dimensions } from "react-native";
import TanitimScreen from "../tanitim";

const { width } = Dimensions.get("window");

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args) } }));

const mockMarkIntroSeen = jest.fn();
jest.mock("@/src/onboarding/introSeen", () => ({ markIntroSeen: (...args: unknown[]) => mockMarkIntroSeen(...args) }));

beforeEach(() => jest.clearAllMocks());

test("shows the first slide's title", () => {
  render(<TanitimScreen />);
  expect(screen.getByText("Fişinizi çekin")).toBeOnTheScreen();
});

test("pressing Geç marks the intro seen and exits through the entry route, not a hardcoded login screen", async () => {
  render(<TanitimScreen />);
  fireEvent.press(screen.getByText("Geç"));
  expect(mockMarkIntroSeen).toHaveBeenCalled();
  await Promise.resolve();
  // "/" — the app's own entry route (`app/index.tsx`), which dispatches an
  // anon session to `/giris` and an authed one to its own shell. Asserting
  // this instead of "/giris" is the C1 regression pin: a replay from the
  // (authed-only) help page must not be hardcoded back to the login form.
  expect(mockReplace).toHaveBeenCalledWith("/");
});

test("the last slide shows Başla instead of İleri, and still shows Geç", () => {
  render(<TanitimScreen />);
  const list = screen.getByTestId("tanitim-slides");
  // Land on the fourth (last) slide by simulating the paging scroll a real
  // swipe would produce, rather than asserting against the component's own
  // index math.
  fireEvent(list, "momentumScrollEnd", {
    nativeEvent: { contentOffset: { x: 3 * width } },
  });

  expect(screen.getByText("Başla")).toBeOnTheScreen();
  expect(screen.queryByText("İleri")).not.toBeOnTheScreen();
  expect(screen.getByText("Geç")).toBeOnTheScreen();
});
