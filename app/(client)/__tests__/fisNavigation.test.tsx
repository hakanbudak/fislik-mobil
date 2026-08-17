import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { router, Tabs } from "expo-router";
import { act, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Text } from "react-native";
import ReceiptStackLayout from "../fis/_layout";
import ReceiptDetailScreen from "../fis/[id]";
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
 * stub `fis.test.tsx` uses) between two receipt ids in sequence, because the
 * bug this pins only appears on the SECOND navigation.
 *
 * Note what is and isn't real here: `fis/_layout` and `fis/[id]` are the
 * app's own files; the group `_layout` is a stand-in `<Tabs>` (the real one
 * pulls in `AuthGate`, fonts and the notification poller, none of which this
 * test is about) that reproduces the one property that matters — the
 * receipt-detail subtree is reached through a tab screen. Point
 * `"fis/[id]"` straight at `ReceiptDetailScreen` and drop the `fis/_layout`
 * entry below and both tests here fail, which is exactly the pre-fix
 * structure.
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
          <Tabs.Screen name="index" />
          <Tabs.Screen name="fis" options={{ href: null }} />
        </Tabs>
      ),
      index: () => <Text>Fişler</Text>,
      "fis/_layout": ReceiptStackLayout,
      "fis/[id]": ReceiptDetailScreen,
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
  // The editor is seeded once per mount from the receipt it was mounted
  // with. When `fis/[id]` was a flat tab screen the route params updated but
  // the screen never re-mounted, so these still read "Migros"/"125,50" — the
  // previously-opened receipt — while the save/delete/period mutations
  // targeted r2. Inside a `Stack` the push mounts a fresh screen instead.
  await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe("Şok Market"));
  expect(screen.getByLabelText("Toplam").props.value).toBe("42,00");
});

test("going back from a receipt returns to the receipt it was opened from", async () => {
  renderApp();

  openReceipt("r1");
  await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe("Migros"));
  openReceipt("r2");
  await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe("Şok Market"));

  act(() => router.back());
  // A flat tab screen has no history of its own: this popped straight out to
  // the list. The stack pops receipt by receipt.
  await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe("Migros"));

  act(() => router.back());
  await waitFor(() => expect(screen.getByText("Fişler")).toBeOnTheScreen());
});
