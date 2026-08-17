import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { router, Tabs } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Text } from "react-native";
import ReceiptsStackLayout from "../(fisler)/_layout";
import ReceiptDetailScreen from "../(fisler)/fis/[id]";
import * as endpoints from "@/src/api/endpoints";
import type { ReceiptOut } from "@/src/api/endpoints";
import { createTestQueryClient } from "@/src/test/queryClient";

jest.mock("@/src/api/endpoints");
jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return { WebView: (props: object) => <View testID="webview" {...props} /> };
});

const mocked = endpoints as jest.Mocked<typeof endpoints>;

/**
 * Drives real expo-router navigation (not the `jest.mock("expo-router", ...)`
 * stub `fis.test.tsx` uses), because both bugs pinned here only appear on a
 * SECOND navigation.
 *
 * Note what is and isn't real: `(fisler)/_layout` and `(fisler)/fis/[id]` are
 * the app's own files; the group `_layout`, the list screen and the second
 * tab are stand-ins (the real ones pull in `AuthGate`, fonts, the upload
 * queue and the notification poller, none of which this test is about). What
 * they preserve is the shape that matters: the receipt detail is pushed onto
 * a stack ROOTED AT THE LIST, inside one tab, with a sibling tab to switch
 * away to.
 *
 * Two structures fail these tests, and they are the two the app has actually
 * shipped. Point `"fis/[id]"` straight at a tab screen with no stack and the
 * editor never re-mounts (test 1). Give the detail a stack under its own
 * list-less tab and back never pops it (tests 2 and 3).
 */
const extraction: NonNullable<ReceiptOut["extraction"]> = {
  status: "done",
  merchant_name: "Migros",
  receipt_date: "2026-08-05",
  total_amount: "125.50",
  vat_total: "18.75",
  vat_breakdown: [],
  doc_type: "fis",
  merchant_tax_id: null,
  merchant_tax_id_type: null,
  merchant_tax_office: null,
  receipt_number: null,
  payment_method: null,
  expense_category: null,
  edited: false,
};

const receipts: ReceiptOut[] = [
  {
    id: "r1",
    period: "2026-08",
    created_at: "2026-08-05T10:00:00Z",
    image_url: "https://example.test/r1.jpg",
    content_type: "image/jpeg",
    processed: false,
    open_issue: null,
    uploaded_by: null,
    extraction: { ...extraction, merchant_name: "Migros", total_amount: "125.50" },
  },
  {
    id: "r2",
    period: "2026-08",
    created_at: "2026-08-06T10:00:00Z",
    image_url: "https://example.test/r2.jpg",
    content_type: "image/jpeg",
    processed: false,
    open_issue: null,
    uploaded_by: null,
    extraction: { ...extraction, merchant_name: "Şok Market", total_amount: "42.00" },
  },
];

function renderApp() {
  const client = createTestQueryClient();
  return renderRouter(
    {
      _layout: () => (
        <Tabs>
          <Tabs.Screen name="(fisler)" />
          <Tabs.Screen name="profil" />
        </Tabs>
      ),
      profil: () => <Text>Profil</Text>,
      "(fisler)/_layout": ReceiptsStackLayout,
      "(fisler)/index": () => <Text>Fişler</Text>,
      "(fisler)/fis/[id]": ReceiptDetailScreen,
    },
    {
      initialUrl: "/",
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
}

function openReceipt(id: string) {
  act(() => {
    router.push({ pathname: "/fis/[id]", params: { id, period: "2026-08" } });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.periodLockStatus.mockResolvedValue({ locked: false, locked_at: null });
  mocked.listReceipts.mockResolvedValue(receipts);
});

test("opening a second receipt shows that receipt, not the one opened before it", async () => {
  renderApp();

  openReceipt("r1");
  await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe("Migros"));
  expect(screen.getByLabelText("Toplam").props.value).toBe("125,50");

  openReceipt("r2");
  // Two independent layers hold this up now: the stack mounts a fresh screen
  // per push, and `ExtractionEditor` re-seeds its draft when `receiptId`
  // changes. Either alone makes this assertion pass — the next test is the
  // one that pins the mount itself, which the editor guard cannot mask.
  await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe("Şok Market"));
  expect(screen.getByLabelText("Toplam").props.value).toBe("42,00");
});

test("back from a receipt returns to the list, and the detail stack never accumulates", async () => {
  const { getPathname } = renderApp();

  // Visiting three receipts in a row must leave the list exactly one back
  // press away every time. When the detail lived in its own list-less tab,
  // back from the second receipt landed on the first one instead — every
  // receipt visited stacked up.
  for (const [id, merchant] of [
    ["r1", "Migros"],
    ["r2", "Şok Market"],
    ["r1", "Migros"],
  ] as const) {
    openReceipt(id);
    await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe(merchant));
    act(() => router.back());
    await waitFor(() => expect(screen.getByText("Fişler")).toBeOnTheScreen());
    expect(getPathname()).toBe("/");
  }
});

test("back still returns to the list after switching tabs in between", async () => {
  const { getPathname } = renderApp();

  openReceipt("r1");
  await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe("Migros"));
  act(() => router.back());
  await waitFor(() => expect(screen.getByText("Fişler")).toBeOnTheScreen());

  act(() => router.push("/profil"));
  await waitFor(() => expect(screen.getByText("Profil")).toBeOnTheScreen());

  openReceipt("r2");
  await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe("Şok Market"));
  act(() => router.back());
  await waitFor(() => expect(screen.getByText("Fişler")).toBeOnTheScreen());
  expect(getPathname()).toBe("/");
});

test("each receipt gets a freshly mounted screen, not a reused one", async () => {
  renderApp();

  // Screen-owned state, not editor-owned: `confirmingDelete` lives in
  // `fis/[id].tsx` and only a re-mount can clear it. If the detail screen
  // were reused — as it was when registered as a flat tab — r2 would open
  // with r1's delete confirmation still showing, and the "Sil" button would
  // be wired to r2. This is the check `ExtractionEditor`'s own `receiptId`
  // guard cannot stand in for.
  openReceipt("r1");
  await waitFor(() => expect(screen.getByText("Fişi sil")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Fişi sil"));
  expect(screen.getByText("Bu fiş silinecek. Emin misiniz?")).toBeOnTheScreen();

  act(() => router.back());
  await waitFor(() => expect(screen.getByText("Fişler")).toBeOnTheScreen());

  openReceipt("r2");
  await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe("Şok Market"));
  expect(screen.queryByText("Bu fiş silinecek. Emin misiniz?")).toBeNull();
  expect(mocked.deleteReceipt).not.toHaveBeenCalled();
});
