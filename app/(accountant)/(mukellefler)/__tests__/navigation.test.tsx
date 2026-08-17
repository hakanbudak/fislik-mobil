import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { router, Tabs } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Text } from "react-native";
import * as clientsStackLayout from "../_layout";
import ReceiptDetailScreen from "../mukellef/[clientId]/fis/[id]";
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
 * and the reason `app/(accountant)/(mukellefler)/_layout.tsx` exists.
 *
 * `(mukellefler)/_layout` and the detail screen are the app's real files; the
 * group `_layout`, the client list and the month screen are stand-ins (the
 * real ones pull in the upload queue, offline state and a camera, none of
 * which this test is about). What they preserve is the shape that matters:
 * one tab whose stack is rooted at the client list, with the month screen and
 * then the receipt pushed above it.
 *
 * The chain asserted below — receipt -> month -> client list, with no screen
 * left behind — fails under both structures the app has shipped: flat tab
 * screens (no re-mount between receipts) and a stack under a separate,
 * list-less tab (back never popped the month, so opening a second client
 * landed on the first one's month).
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

function renderApp(initialUrl = "/") {
  const client = createTestQueryClient();
  return renderRouter(
    {
      _layout: () => (
        <Tabs>
          <Tabs.Screen name="(mukellefler)" />
          <Tabs.Screen name="profil" />
        </Tabs>
      ),
      profil: () => <Text>Profil</Text>,
      "(mukellefler)/_layout": { ...clientsStackLayout },
      "(mukellefler)/index": () => <Text>Mükellefler</Text>,
      "(mukellefler)/mukellef/[clientId]": () => <Text>Ağustos 2026</Text>,
      "(mukellefler)/mukellef/[clientId]/fis/[id]": ReceiptDetailScreen,
    },
    {
      initialUrl,
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
}

function openReceipt(id: string, clientId = "c1") {
  act(() => {
    router.push({
      pathname: "/mukellef/[clientId]/fis/[id]",
      params: { clientId, id, period: "2026-08" },
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

test("back steps receipt -> month -> client list, leaving nothing behind", async () => {
  const { getPathname } = renderApp();

  // Two clients in a row. Each must unwind completely, or the next month
  // screen stacks on top of the previous one — the regression a detail stack
  // under its own list-less tab caused.
  for (const clientId of ["c1", "c2"]) {
    act(() => router.push({ pathname: "/mukellef/[clientId]", params: { clientId } }));
    await waitFor(() => expect(screen.getByText("Ağustos 2026")).toBeOnTheScreen());
    expect(getPathname()).toBe(`/mukellef/${clientId}`);

    openReceipt("r1", clientId);
    await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe("Migros"));

    act(() => router.back());
    await waitFor(() => expect(screen.getByText("Ağustos 2026")).toBeOnTheScreen());
    expect(getPathname()).toBe(`/mukellef/${clientId}`);

    act(() => router.back());
    await waitFor(() => expect(screen.getByText("Mükellefler")).toBeOnTheScreen());
    expect(getPathname()).toBe("/");
  }
});

test("each receipt gets a freshly mounted screen, not a reused one", async () => {
  renderApp();
  act(() => router.push({ pathname: "/mukellef/[clientId]", params: { clientId: "c1" } }));
  await waitFor(() => expect(screen.getByText("Ağustos 2026")).toBeOnTheScreen());

  // `IssueSection`'s composer state is owned by a child of the detail screen
  // and only a re-mount clears it, so this pins the mount itself rather than
  // the display — which `ExtractionEditor`'s own `receiptId` guard would
  // otherwise cover up.
  openReceipt("r1");
  await waitFor(() => expect(screen.getByText("Sorun bildir")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Sorun bildir"));
  expect(screen.getByLabelText("Sorun mesajı")).toBeOnTheScreen();

  act(() => router.back());
  await waitFor(() => expect(screen.getByText("Ağustos 2026")).toBeOnTheScreen());

  openReceipt("r2");
  await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe("Şok Market"));
  expect(screen.queryByLabelText("Sorun mesajı")).toBeNull();
  expect(screen.getByText("Sorun bildir")).toBeOnTheScreen();
});

test("a receipt opened by deep link can still navigate back", async () => {
  // See the client's counterpart. A stack has one anchor, so the client list
  // — not the month, which was never visited — is what sits beneath a
  // deep-linked receipt.
  const { getPathname } = renderApp("/mukellef/c1/fis/r2?period=2026-08");
  await waitFor(() => expect(screen.getByLabelText("Satıcı").props.value).toBe("Şok Market"));
  expect(router.canGoBack()).toBe(true);

  act(() => router.back());
  await waitFor(() => expect(screen.getByText("Mükellefler")).toBeOnTheScreen());
  expect(getPathname()).toBe("/");
});
