import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { router, Tabs } from "expo-router";
import { act, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Text } from "react-native";
import ClientStackLayout from "../_layout";
import ReceiptDetailScreen from "../[clientId]/fis/[id]";
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
 * The accountant's counterpart to `app/(client)/__tests__/fisNavigation.test.tsx`,
 * and the reason `app/(accountant)/mukellef/_layout.tsx` exists: without it
 * expo-router hoisted `mukellef/[clientId]/fis/[id]` into the accountant's
 * tab navigator as its own flat tab screen, so a second receipt re-used the
 * first one's mounted screen — params refreshed, component state did not.
 *
 * `mukellef/_layout` and the detail screen are the app's real files; the
 * group `_layout` and the month screen are stand-ins (the real month screen
 * pulls in the upload queue, offline state and a camera, none of which this
 * test is about) that preserve the shape that matters: the subtree is
 * reached through a tab screen, and the receipt is pushed from the month
 * screen.
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
    image_url: "https://r2/r1.jpg",
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
    image_url: "https://r2/r2.jpg",
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
          <Tabs.Screen name="mukellef" options={{ href: null }} />
        </Tabs>
      ),
      index: () => <Text>Mükellefler</Text>,
      "mukellef/_layout": ClientStackLayout,
      "mukellef/[clientId]": () => <Text>Ağustos 2026</Text>,
      "mukellef/[clientId]/fis/[id]": ReceiptDetailScreen,
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
    router.push({
      pathname: "/mukellef/[clientId]/fis/[id]",
      params: { clientId: "c1", id, period: "2026-08" },
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.clientReceipts.mockResolvedValue(receipts);
});

test("opening a second receipt shows that receipt, not the one opened before it", async () => {
  renderApp();
  act(() => router.push({ pathname: "/mukellef/[clientId]", params: { clientId: "c1" } }));
  await waitFor(() => expect(screen.getByText("Ağustos 2026")).toBeOnTheScreen());

  openReceipt("r1");
  await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe("Migros"));
  expect(screen.getByLabelText("Toplam").props.value).toBe("125,50");

  openReceipt("r2");
  await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe("Şok Market"));
  expect(screen.getByLabelText("Toplam").props.value).toBe("42,00");
});

test("back from a receipt lands on the month screen it was opened from, and back again on the client list", async () => {
  renderApp();
  act(() => router.push({ pathname: "/mukellef/[clientId]", params: { clientId: "c1" } }));
  await waitFor(() => expect(screen.getByText("Ağustos 2026")).toBeOnTheScreen());
  openReceipt("r1");
  await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe("Migros"));

  act(() => router.back());
  await waitFor(() => expect(screen.getByText("Ağustos 2026")).toBeOnTheScreen());

  act(() => router.back());
  await waitFor(() => expect(screen.getByText("Mükellefler")).toBeOnTheScreen());
});
