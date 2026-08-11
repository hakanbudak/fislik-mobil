# Mobile Fit and Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app fit a real phone — safe areas, a four-item tab bar, reachable touch targets — and add the introduction and help page the first device run showed were missing.

**Architecture:** A safe-area and gesture foundation is installed once at the root so no screen has to think about insets. The two tab shells hide their leaked routes and adopt the web's narrow-screen sizing. A shared header carries the brand. The introduction is a route gated by an AsyncStorage flag; help is one role-aware page reachable from Profil.

**Tech Stack:** Expo SDK 57, expo-router, `react-native-safe-area-context`, `react-native-gesture-handler`, `expo-status-bar`, AsyncStorage.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-11-mobile-fit-and-onboarding-design.md`. Read it before starting.
- All user-facing copy is Turkish. Code, comments, commit messages and file names are English.
- Commit messages must be English with NO AI/Claude attribution and NO `Co-Authored-By` trailer.
- Colours only from `src/theme/tokens.ts`. No hex literal outside it, and no hardcoded alpha suffix appended to a token.
- API payload types only from `src/api/generated/schema.d.ts`.
- User-facing failures go through `apiErrorMessage(error, overrides?)`; `ApiError.detail` must never reach the UI.
- Busy button labels use `Button`'s `busyTitle` prop.
- Tests needing a query client use `createTestQueryClient()` from `@/src/test/queryClient`.
- Form screens reuse `src/auth/AuthShell.tsx`'s `KeyboardAvoidingView` + `ScrollView` pairing.
- `npx jest` and `npx tsc --noEmit` must pass before every commit.
- **The web app is the reference for user-visible layout and copy.** Where this plan and `fislik-web` disagree, the web wins — take values from the source.
- Run commands in the FOREGROUND. Never run `--detectOpenHandles` over the full suite; it hangs.

**Baseline:** commit `1821181`, 62 suites / 394 tests passing.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `app/_layout.tsx` | Adds `GestureHandlerRootView`, `SafeAreaProvider`, `StatusBar` around the existing provider stack |
| `app/(client)/_layout.tsx`, `app/(accountant)/_layout.tsx` | Hide leaked routes, adopt the web's tab-bar sizing, consume the bottom inset, mount the header |
| `src/theme/components/AppHeader.tsx` | The 56pt brand header shared by both shells |
| `src/theme/components/MonthPicker.tsx` | Hit slop on the chevrons |
| `src/features/upload/CaptureScreen.tsx` | Hit slop on the camera controls |
| `app/(client)/index.tsx` | List bottom padding clearing the FAB |
| `src/features/receipts/ExtractionEditor.tsx` | Flexible width in place of the fixed 108pt |
| `src/onboarding/introSeen.ts` | The first-launch flag |
| `app/(auth)/tanitim.tsx` | The four introduction screens |
| `app/index.tsx` | Routes to the introduction when the flag is unset |
| `src/features/help/HelpContent.tsx` | Role-aware help body |
| `app/(client)/yardim.tsx`, `app/(accountant)/yardim.tsx` | The help route for each shell |

---

### Task 1: Safe-area and gesture foundation

**Files:**
- Modify: `app/_layout.tsx`
- Test: `app/__tests__/layout-providers.test.tsx`

**Interfaces:**
- Produces: every screen can call `useSafeAreaInsets()`, and gestures work on Android. Later tasks depend on both.

- [ ] **Step 1: Write the failing test**

`app/__tests__/layout-providers.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import RootLayout from "../_layout";

jest.mock("expo-router", () => ({
  Slot: () => null,
  SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
}));
jest.mock("expo-font", () => ({ useFonts: () => [true] }));
jest.mock("@/src/upload/worker", () => ({ startWorker: () => () => undefined }));
jest.mock("@/src/auth/AuthProvider", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

test("wraps the app in the gesture and safe-area providers", () => {
  render(<RootLayout />);
  expect(screen.UNSAFE_getByType(GestureHandlerRootView)).toBeTruthy();
  expect(screen.UNSAFE_getByType(SafeAreaProvider)).toBeTruthy();
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest app/__tests__/layout-providers.test.tsx`
Expected: FAIL — neither provider is present.

- [ ] **Step 3: Wrap the provider stack**

In `app/_layout.tsx`, import at the top:

```tsx
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
```

and replace the returned tree:

```tsx
  return (
    // GestureHandlerRootView must be the outermost view or react-native-gesture-handler
    // receives no events on Android — the receipt viewer's pinch-to-zoom depends on it.
    // SafeAreaProvider sits inside it so every screen can reach the device insets.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Slot />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
```

Install the status-bar package if it is not already a dependency: `npx expo install expo-status-bar`.

- [ ] **Step 4: Run the test and the suite**

Run: `npx jest app/__tests__/layout-providers.test.tsx` then `npx jest`
Expected: PASS, and no existing test breaks.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(layout): add the gesture and safe-area providers at the root

Neither existed, so no screen could reach the device insets and gestures
received no events on Android."
```

---

### Task 2: Hide the leaked tabs and adopt the web's tab bar

**Files:**
- Modify: `app/(client)/_layout.tsx`, `app/(accountant)/_layout.tsx`
- Test: `app/(client)/__tests__/layout.test.tsx`, `app/(accountant)/__tests__/layout.test.tsx`

**Interfaces:**
- Produces: exactly four tabs for the client and three for the accountant; every other route in those groups is reachable by navigation but absent from the bar.

**The defect:** `app/(client)/` holds seven route files and registers four `Tabs.Screen`s, so `kamera`, `firma-bilgileri` and `fis/[id]` appear as tabs with placeholder chevron icons and the labels truncate. The accountant shell has the same defect from its `mukellef/*` routes — **how many entries a nested route directory produces has not been observed, so check what actually appears rather than assuming a count.**

- [ ] **Step 1: Find out what the accountant shell actually renders**

Run `npx expo start`, open the accountant role, and look at the tab bar; or read `expo-router`'s route tree for that group. Record the exact list of unwanted entries in your report before writing code. Do not guess.

- [ ] **Step 2: Write the failing tests**

`app/(client)/__tests__/layout.test.tsx`:

```tsx
import ClientTabsLayout from "../_layout";

test("registers every route in the group, hiding the ones that are not tabs", () => {
  const tree = ClientTabsLayout();
  const screens = JSON.stringify(tree);
  for (const hidden of ["kamera", "firma-bilgileri", "fis/[id]"]) {
    expect(screens).toContain(hidden);
  }
  // Each hidden route must carry href: null so it never renders in the bar.
  expect((screens.match(/"href":null/g) ?? []).length).toBe(3);
});
```

Write the accountant equivalent using the list you recorded in step 1.

- [ ] **Step 3: Run them and confirm they fail**

Run: `npx jest layout.test`
Expected: FAIL — no `href: null` appears anywhere in the app today.

- [ ] **Step 4: Hide the leaked routes and style the bar**

In `app/(client)/_layout.tsx`, add a `Tabs.Screen` for each non-tab route:

```tsx
        <Tabs.Screen name="kamera" options={{ href: null }} />
        <Tabs.Screen name="firma-bilgileri" options={{ href: null }} />
        <Tabs.Screen name="fis/[id]" options={{ href: null }} />
```

and replace `screenOptions`' bar styling with the web's narrow-screen values from `fislik-web/src/components/ClientShell.tsx` — read them from the source rather than from this plan:

```tsx
  const insets = useSafeAreaInsets();
  // Web's bottom nav: border-t, bg-card, px-2.5 pb-2.5 pt-1.5, items at
  // text-[10px] font-bold with 21px icons. pb becomes 10 + the home-indicator
  // inset so labels never sit on the indicator bar.
  tabBarStyle: {
    backgroundColor: tokens.color.card,
    borderTopColor: tokens.color.border,
    borderTopWidth: 1,
    paddingTop: tokens.space(1.5),
    paddingBottom: tokens.space(2.5) + insets.bottom,
    height: 56 + insets.bottom,
  },
  tabBarLabelStyle: { ...text.caption, fontSize: 10 },
  tabBarIconStyle: { marginBottom: 0 },
```

Apply the same to `app/(accountant)/_layout.tsx`, hiding the entries you recorded in step 1.

- [ ] **Step 5: Run the tests and the suite**

Run: `npx jest layout.test` then `npx jest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(nav): hide non-tab routes and size the tab bar like the web

Seven routes were rendering in a bar built for four, truncating every label."
```

---

### Task 3: The brand header

**Files:**
- Create: `src/theme/components/AppHeader.tsx`, `src/theme/components/__tests__/AppHeader.test.tsx`
- Modify: `app/(client)/_layout.tsx`, `app/(accountant)/_layout.tsx`

**Interfaces:**
- Produces: `<AppHeader />` — a 56pt row with `FislikMark` at 22×31 and the word "Fişlik", consuming the top safe-area inset.

**Deliberate divergence from the web, recorded in the spec:** the web's header also holds a notification button duplicating its own bottom-nav entry. Mobile drops it — the tab bar already carries the unread badge, and two routes to one destination is not worth the vertical space on a phone. Do not add it.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppHeader } from "../AppHeader";

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };

test("renders the brand and leaves room for the status bar", () => {
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
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx jest AppHeader`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/theme/components/AppHeader.tsx`:

```tsx
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FislikMark } from "./FislikMark";
import { tokens } from "../tokens";
import { font } from "../typography";

/**
 * The 56pt brand row above both tab shells, ported from the web's
 * narrow-screen header. The top safe-area inset is added as padding so the
 * content clears the status bar and the Dynamic Island.
 */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top, height: 56 + insets.top }]}>
      <FislikMark width={22} height={31} />
      <Text style={styles.wordmark}>Fişlik</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space(2),
    paddingHorizontal: tokens.space(4),
    backgroundColor: tokens.color.card,
  },
  wordmark: {
    fontFamily: font.bold,
    fontSize: 19,
    letterSpacing: -1,
    color: tokens.color.ink,
  },
});
```

- [ ] **Step 4: Mount it in both shells**

In each `_layout.tsx`, render it above `<Tabs>` and below `<ImpersonationBanner />`, so an impersonation warning stays the topmost thing on screen.

- [ ] **Step 5: Run the tests and the suite, then commit**

```bash
git add -A
git commit -m "feat(nav): add the brand header above both tab shells"
```

---

### Task 4: Reachable touch targets and a clear FAB

**Files:**
- Modify: `src/theme/components/MonthPicker.tsx`, `src/features/upload/CaptureScreen.tsx`, `app/(client)/index.tsx`, `src/features/receipts/ExtractionEditor.tsx`
- Test: `src/theme/components/__tests__/MonthPicker.test.tsx`

**Interfaces:**
- Produces: no behaviour change, only reachability. Visual sizes stay as they are.

**Why:** the month picker's chevrons and the camera controls are 32×32, below the 44pt minimum, so users miss them. The camera FAB covers the last receipt card because the list's bottom padding does not account for it. `ExtractionEditor`'s fixed 108pt width can overflow a 375pt screen.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react-native";
import { MonthPicker } from "../MonthPicker";

test("the month chevrons are reachable at 44pt without growing visually", () => {
  render(<MonthPicker value="2026-07" onChange={jest.fn()} />);
  const previous = screen.getByLabelText("Önceki ay");
  // 32pt control + 6pt of slop on every side = a 44pt touch target.
  expect(previous.props.hitSlop).toEqual({ top: 6, bottom: 6, left: 6, right: 6 });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx jest MonthPicker`
Expected: FAIL — `hitSlop` is undefined.

- [ ] **Step 3: Apply the fixes**

Add `hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}` to both `Pressable`s in `MonthPicker`, and to the 32×32 controls in `CaptureScreen`.

In `app/(client)/index.tsx`, give the `FlatList`'s `contentContainerStyle` a bottom padding that clears the FAB: the FAB's height plus its offset plus `insets.bottom`. Read the FAB's actual size from the stylesheet rather than assuming.

In `ExtractionEditor`, replace `rowItemSmall: { width: 108 }` with `{ flex: 1, minWidth: 96 }` so the row reflows on a narrow screen.

- [ ] **Step 4: Run the tests and the suite, then commit**

```bash
git add -A
git commit -m "fix(ui): make small controls reachable and keep the FAB off the list"
```

---

### Task 5: The introduction

**Files:**
- Create: `src/onboarding/introSeen.ts`, `src/onboarding/__tests__/introSeen.test.ts`, `app/(auth)/tanitim.tsx`, `app/(auth)/__tests__/tanitim.test.tsx`
- Modify: `app/index.tsx`

**Interfaces:**
- Produces:
  - `hasSeenIntro(): Promise<boolean>` and `markIntroSeen(): Promise<void>`, backed by AsyncStorage under `fislik.intro_seen`.
  - `resetIntro(): Promise<void>` — Task 6's help page replays the tour with it.
  - The route `/(auth)/tanitim`.

**The four screens, in order:** photograph your receipt · send it to your accountant · follow its status · it works without a connection. The fourth earns its place: a user who does not know the offline queue exists will assume a capture taken with no signal was lost.

- [ ] **Step 1: Write the failing flag test**

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { hasSeenIntro, markIntroSeen, resetIntro } from "../introSeen";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}));
const store = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => jest.clearAllMocks());

test("a fresh install has not seen the intro", async () => {
  store.getItem.mockResolvedValue(null);
  await expect(hasSeenIntro()).resolves.toBe(false);
});

test("marking it seen persists under the documented key", async () => {
  await markIntroSeen();
  expect(store.setItem).toHaveBeenCalledWith("fislik.intro_seen", "1");
});

test("resetting lets the tour play again", async () => {
  await resetIntro();
  expect(store.removeItem).toHaveBeenCalledWith("fislik.intro_seen");
});
```

- [ ] **Step 2: Run and confirm failure, then implement**

`src/onboarding/introSeen.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "fislik.intro_seen";

export async function hasSeenIntro(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === "1";
}

export async function markIntroSeen(): Promise<void> {
  await AsyncStorage.setItem(KEY, "1");
}

/** Lets the help page replay the tour. */
export async function resetIntro(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
```

- [ ] **Step 3: Build the tour screen**

`app/(auth)/tanitim.tsx` renders a horizontal paging `FlatList` of four slides, each with an icon from `lucide-react-native`, a Turkish title and one sentence. Page dots below. "Geç" is visible on every slide; the last slide's primary action reads "Başla". Both call `markIntroSeen()` then `router.replace("/giris")`.

The four titles, in order — use these, and write one supporting sentence under each:

1. `Fişini çek` — the camera, and that several in a row is the normal way to use it.
2. `Muhasebecine gönder` — a month is sent when it is ready, not receipt by receipt.
3. `Durumunu takip et` — each receipt shows whether it has been read and processed.
4. `İnternet olmasa da çalışır` — captures wait on the phone and upload themselves when a connection returns.

This screen has no web counterpart, so the supporting sentences are yours. Keep each to one line on a 375pt screen, and describe what happens rather than which button to press.

- [ ] **Step 4: Gate it from the entry route**

`app/index.tsx` currently redirects `anon` to `/giris`. Before that, when the session is `anon` and `hasSeenIntro()` resolves false, redirect to `/(auth)/tanitim` instead. Hold the redirect until the flag has been read so the login screen never flashes first.

- [ ] **Step 5: Write the routing tests**

Cover: a first launch routes to the tour; a second launch goes straight to `/giris`; pressing "Geç" marks it seen and leaves.

- [ ] **Step 6: Run the suite and commit**

```bash
git add -A
git commit -m "feat(onboarding): introduce the app on first launch"
```

---

### Task 6: The help page

**Files:**
- Create: `src/features/help/HelpContent.tsx`, `src/features/help/__tests__/HelpContent.test.tsx`, `app/(client)/yardim.tsx`, `app/(accountant)/yardim.tsx`
- Modify: `app/(client)/profil.tsx`, `app/(client)/_layout.tsx`, `app/(accountant)/_layout.tsx`

**Interfaces:**
- Consumes: `useAuth()` for the role, `resetIntro()` from Task 5.
- Produces: `<HelpContent role={Role} />` and a `/yardim` route in both shells.

**Content, by role.** Taxpayer: photographing receipts, choosing a month, sending the month to the accountant, and what to do when an issue is reported. Accountant: inviting a taxpayer, marking receipts processed, closing a month, and exporting the archive. Both end with an action that replays the introduction.

Write the Turkish yourself — there is no web counterpart. Describe what the user does and what happens, not what the buttons are called, so the page survives a label change.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react-native";
import { HelpContent } from "../HelpContent";

test("a taxpayer sees the receipt workflow", () => {
  render(<HelpContent role="client" onReplayIntro={jest.fn()} />);
  expect(screen.getByText(/muhasebecinize gönder/i)).toBeOnTheScreen();
  expect(screen.queryByText(/mükellef davet/i)).toBeNull();
});

test("an accountant sees the filing workflow", () => {
  render(<HelpContent role="accountant" onReplayIntro={jest.fn()} />);
  expect(screen.getByText(/mükellef davet/i)).toBeOnTheScreen();
  expect(screen.queryByText(/muhasebecinize gönder/i)).toBeNull();
});
```

Adjust the matchers to the copy you actually write; keep the shape — each role sees its own workflow and not the other's.

- [ ] **Step 2: Run and confirm failure, then implement**

Build `HelpContent` as a scrolling list of numbered steps, reusing `Card` and the typography tokens. Reuse `AuthShell`'s `KeyboardAvoidingView` pairing only if the page grows an input; it should not.

- [ ] **Step 3: Add the routes and the link**

Create `app/(client)/yardim.tsx` rendering `<HelpContent role="client" …/>` and `app/(accountant)/yardim.tsx` for the accountant. Register both with `href: null` in their shells so they do not become tabs — the same defect Task 2 fixed.

In `app/(client)/profil.tsx`, add a "Nasıl kullanılır" entry beside the existing "Firma bilgileri" link. Note that `profil.tsx` is shared: the accountant re-exports it, so route to the correct group based on `role` exactly as the company link already does.

- [ ] **Step 4: Wire the replay**

The replay action calls `resetIntro()` then `router.replace("/(auth)/tanitim")`. Add a test that it does both.

- [ ] **Step 5: Run the suite and commit**

```bash
git add -A
git commit -m "feat(help): add a role-aware help page under the profile"
```

---

## Notes for the implementer

**Device verification is the acceptance gate for Tasks 1-4.** They are visual, and the suite can only pin their structure. When those tasks are done, the change must be looked at on a phone before it is called finished.

**Never assume a layout value.** Every number in this plan that mirrors the web came from `fislik-web/src/components/ClientShell.tsx`. Read the source; if it disagrees with this plan, the source wins and the discrepancy goes in your report.

**The tab-leak defect will recur.** Any new route file added under `app/(client)/` or `app/(accountant)/` becomes a tab unless it is registered with `href: null`. Task 6 adds two such routes; later work must do the same.
