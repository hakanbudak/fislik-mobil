import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Redirect } from "expo-router";
import { FlatList } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TanitimScreen, { DOTS_GAP, DOT_HIT_SLOP_HORIZONTAL } from "../tanitim";

// Card pager snap interval (300pt card + 16pt gap) — see app/tanitim.tsx.
// The pager's index tracking must divide by this, not by window width, so
// tests that simulate a scroll drive the offset off this constant.
const SNAP_INTERVAL = 316;

// This screen has no ancestor layout to inherit safe-area clearance from
// (see app/tanitim.tsx), so it reads useSafeAreaInsets() itself — which
// throws outside a SafeAreaProvider. Same metrics AppHeader.test.tsx uses.
const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

function renderTour() {
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <TanitimScreen />
    </SafeAreaProvider>,
  );
}

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  Redirect: jest.fn(() => null),
}));

const mockMarkIntroSeen = jest.fn();
jest.mock("@/src/onboarding/introSeen", () => ({
  markIntroSeen: (...args: unknown[]) => mockMarkIntroSeen(...args),
}));

const mockUseAuth = jest.fn();
jest.mock("@/src/auth/AuthProvider", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("@/src/auth/LockedScreen", () => ({ LockedScreen: () => null }));

const mockedRedirect = Redirect as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockMarkIntroSeen.mockResolvedValue(undefined);
});

test("an anon visitor is sent to /giris, never seeing either role's slides", () => {
  mockUseAuth.mockReturnValue({ status: "anon", user: null });
  renderTour();
  expect(mockedRedirect).toHaveBeenCalledWith({ href: "/giris" }, undefined);
  expect(screen.queryByTestId("tanitim-slides")).toBeNull();
});

test("shows a spinner instead of the tour while the session is still restoring", () => {
  mockUseAuth.mockReturnValue({ status: "loading", user: null });
  renderTour();
  expect(mockedRedirect).not.toHaveBeenCalled();
  expect(screen.queryByTestId("tanitim-slides")).toBeNull();
});

test("shows the locked screen instead of the tour when biometric unlock is pending", () => {
  mockUseAuth.mockReturnValue({ status: "locked", user: { id: "u1", role: "client" } });
  renderTour();
  expect(mockedRedirect).not.toHaveBeenCalled();
  expect(screen.queryByTestId("tanitim-slides")).toBeNull();
});

test("a client sees the client slides, not the accountant's", () => {
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  renderTour();
  expect(screen.getByText("Fişinizi çekin")).toBeOnTheScreen();
  expect(screen.queryByText("Mükellefinizi davet edin")).toBeNull();
});

test("an accountant sees the accountant slides, not the client's", () => {
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u2", role: "accountant" } });
  renderTour();
  expect(screen.getByText("Mükellefinizi davet edin")).toBeOnTheScreen();
  expect(screen.queryByText("Fişinizi çekin")).toBeNull();
});

test("pressing Geç marks the intro seen and exits through the entry route, not a hardcoded login screen", async () => {
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  renderTour();
  fireEvent.press(screen.getByText("Geç"));
  expect(mockMarkIntroSeen).toHaveBeenCalled();
  // `waitFor` polls rather than assuming a fixed number of microtask turns
  // for `finish()` to resolve — a hand-tuned `await Promise.resolve()`
  // count here would silently break the moment `finish()`'s own await
  // shape changes, even though nothing about this test's actual claim
  // (what href it ends up navigating to) would be wrong.
  await waitFor(() =>
    // "/" — the app's own entry route (`app/index.tsx`), which dispatches an
    // anon session to `/giris` and an authed one to its own shell. Asserting
    // this instead of "/giris" is the C1 regression pin: a replay from the
    // (authed-only) help page must not be hardcoded back to the login form.
    expect(mockReplace).toHaveBeenCalledWith("/"),
  );
});

test("a failed flag write does not trap the user on this screen — finish() still navigates onward", async () => {
  mockMarkIntroSeen.mockRejectedValue(new Error("storage unavailable"));
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  renderTour();
  fireEvent.press(screen.getByText("Geç"));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
});

test("the last slide shows Başla instead of İleri, and still shows Geç, for either role", () => {
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u2", role: "accountant" } });
  renderTour();
  const list = screen.getByTestId("tanitim-slides");
  // Land on the fourth (last) slide by simulating the paging scroll a real
  // swipe would produce, rather than asserting against the component's own
  // index math. Offset is a multiple of the 316pt snap interval, not of
  // window width — see SNAP_INTERVAL above.
  fireEvent(list, "momentumScrollEnd", {
    nativeEvent: { contentOffset: { x: 3 * SNAP_INTERVAL } },
  });

  expect(screen.getByText("Başla")).toBeOnTheScreen();
  expect(screen.queryByText("İleri")).not.toBeOnTheScreen();
  expect(screen.getByText("Geç")).toBeOnTheScreen();
});

test("the visible slide is derived from the 316pt snap interval, not from window width", () => {
  // In this jest environment Dimensions.get("window").width is 750 — a
  // scroll offset of 632 is exactly 2 card-intervals (2 * 316) but is NOT
  // a clean multiple of 750. A component that (wrongly) divided by window
  // width would round 632 / 750 ≈ 0.84 down to slide 1, not 2 — this test
  // pins the correct divisor.
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  renderTour();
  const list = screen.getByTestId("tanitim-slides");
  fireEvent(list, "momentumScrollEnd", {
    nativeEvent: { contentOffset: { x: 2 * SNAP_INTERVAL } },
  });

  expect(screen.getByTestId("tanitim-dot-2").props.accessibilityState).toEqual({ selected: true });
  expect(screen.getByTestId("tanitim-dot-1").props.accessibilityState).toEqual({ selected: false });
});

test("tapping a dot jumps straight to that slide", () => {
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  renderTour();

  fireEvent.press(screen.getByTestId("tanitim-dot-3"));

  expect(screen.getByTestId("tanitim-dot-3").props.accessibilityState).toEqual({ selected: true });
  expect(screen.getByText("Başla")).toBeOnTheScreen();
  expect(screen.queryByText("İleri")).not.toBeOnTheScreen();
  expect(screen.getByText("Geç")).toBeOnTheScreen();
});

test("the header and footer fold in a real top/bottom safe-area inset instead of sitting under the status bar or home indicator", () => {
  // This screen has no ancestor layout applying insets.top/insets.bottom
  // for it (unlike the (auth)/(client)/(accountant) group layouts) — it
  // must read useSafeAreaInsets() itself. SAFE_AREA_METRICS above uses a
  // realistic notched-device inset (top 59, bottom 34); a component that
  // silently dropped the insets would render the header's own fixed 14pt
  // and the footer's own fixed 20pt regardless of this value.
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  renderTour();

  const header = screen.getByTestId("tanitim-header");
  const footer = screen.getByTestId("tanitim-footer");
  const headerStyle = Array.isArray(header.props.style) ? header.props.style[1] : header.props.style;
  const footerStyle = Array.isArray(footer.props.style) ? footer.props.style[1] : footer.props.style;

  // 59 (inset.top) + 14 (the header's own design padding).
  expect(headerStyle.paddingTop).toBe(73);
  // 34 (inset.bottom) + 20 (the footer's own design padding, tokens.space(5)).
  expect(footerStyle.paddingBottom).toBe(54);
});

test("a dot's horizontal hit-slop can never reach half the gap between dots", () => {
  // C1 regression pin (review): the dots sit DOTS_GAP (6pt) apart. If
  // horizontal hit-slop reached (or exceeded) half that gap, two
  // neighbouring dots' touch areas would overlap, and RN resolves an
  // overlapping tap to the later-rendered (rightward) view — so a tap
  // aimed at dot 3 would silently land on dot 4 instead. This can't be
  // caught by simulating a `press` on a specific element (fireEvent.press
  // bypasses hit-testing entirely), so it pins the geometric invariant
  // that prevents the overlap from ever existing, rather than the tap
  // outcome itself.
  expect(DOT_HIT_SLOP_HORIZONTAL).toBeLessThan(DOTS_GAP / 2);

  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  renderTour();
  const dot = screen.getByTestId("tanitim-dot-1");
  expect(dot.props.hitSlop.left).toBe(DOT_HIT_SLOP_HORIZONTAL);
  expect(dot.props.hitSlop.right).toBe(DOT_HIT_SLOP_HORIZONTAL);
});

test("tapping a dot scrolls the pager by the 316pt snap interval, not by window width", () => {
  // I2 regression pin (review): `setIndex` fires independently of the
  // imperative scroll, so a test that only checks the resulting active
  // dot (as the existing "tapping a dot jumps straight to that slide"
  // test does) would stay green even if `goTo`'s `scrollToOffset` offset
  // was computed off window width instead of SNAP_INTERVAL. Spying on the
  // imperative call itself closes that gap.
  const scrollSpy = jest.spyOn(FlatList.prototype, "scrollToOffset").mockImplementation(() => {});
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  renderTour();

  fireEvent.press(screen.getByTestId("tanitim-dot-2"));

  expect(scrollSpy).toHaveBeenCalledWith({ offset: 2 * SNAP_INTERVAL, animated: true });
  scrollSpy.mockRestore();
});

test("the pager's leading/trailing inset centers the first and last card for the viewport width", () => {
  // I3 regression pin (review): nothing previously asserted on
  // `contentContainerStyle.paddingHorizontal`, so swapping the handoff's
  // `(windowWidth - CARD_WIDTH) / 2` formula for something else (window
  // width itself, a fixed literal, ...) would leave every other test
  // green. In this jest environment window width is 750
  // (Dimensions.get("window").width, matched by useWindowDimensions()),
  // so (750 - 300) / 2 = 225 — well above the 12pt floor, so this pins the
  // formula itself, not the floor clamp (already covered by the module's
  // own comment/report for narrow devices).
  mockUseAuth.mockReturnValue({ status: "authed", user: { id: "u1", role: "client" } });
  renderTour();

  const list = screen.getByTestId("tanitim-slides");
  expect(list.props.contentContainerStyle.paddingHorizontal).toBe(225);
});
