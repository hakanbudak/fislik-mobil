import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react-native";
import ReceiptDetailScreen from "../[id]";
import * as endpoints from "@/src/api/endpoints";
import type { ReceiptOut } from "@/src/api/endpoints";
import { createTestQueryClient } from "@/src/test/queryClient";

/**
 * I3 (review follow-up): this screen has no web counterpart to port a poll
 * from (the accountant reviews receipts inline in AccountantMonthPage, not
 * via a separate detail route), but the earlier reasoning for leaving it
 * unpolled only covered the common case — pushed from
 * ../../[clientId].tsx, which shares this exact query key and was already
 * polling, so this screen inherited live updates for free. A direct deep
 * link straight into this screen has no such screen to inherit from, so
 * it showed a permanently stale "analiz ediliyor…". Given the poll's own
 * predicate now IS ported here too (id-scoped, matching the client
 * sibling's), this covers it the same way as the other three screens.
 */
jest.mock("@/src/api/endpoints");
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ clientId: "c1", id: "r1", period: "2026-08" }),
}));
jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return { WebView: (props: object) => <View testID="webview" {...props} /> };
});

const mocked = endpoints as jest.Mocked<typeof endpoints>;

// A full shape, not just `{ status: "pending" }` — `ExtractionEditor`
// (rendered by this screen) reads fields like `vat_breakdown` unconditionally,
// regardless of `status`, and crashes on a partial extraction.
const baseExtraction: NonNullable<ReceiptOut["extraction"]> = {
  status: "pending",
  merchant_name: null,
  receipt_date: null,
  total_amount: null,
  vat_total: null,
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

function pendingReceipt(overrides: Partial<ReceiptOut> = {}): ReceiptOut {
  return {
    id: "r1",
    period: "2026-08",
    created_at: "2026-08-05T10:00:00Z",
    image_url: "https://r2/r1.jpg",
    content_type: "image/jpeg",
    processed: false,
    open_issue: null,
    uploaded_by: null,
    extraction: baseExtraction,
    ...overrides,
  };
}

function analyzedReceipt(): ReceiptOut {
  return {
    ...pendingReceipt(),
    extraction: { ...baseExtraction, status: "done", merchant_name: "Migros" },
  };
}

function renderScreen() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ReceiptDetailScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function act5s() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000);
  });
}

async function act20s() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(20000);
  });
}

test("a cold deep link into this screen polls every 5s while the receipt is still being analyzed, and stops once it resolves", async () => {
  mocked.clientReceipts.mockResolvedValueOnce([pendingReceipt()]);
  renderScreen();
  await waitFor(() => expect(mocked.clientReceipts).toHaveBeenCalledTimes(1));

  mocked.clientReceipts.mockResolvedValueOnce([pendingReceipt()]);
  await act5s();
  await waitFor(() => expect(mocked.clientReceipts).toHaveBeenCalledTimes(2));

  mocked.clientReceipts.mockResolvedValueOnce([analyzedReceipt()]);
  await act5s();
  await waitFor(() => expect(mocked.clientReceipts).toHaveBeenCalledTimes(3));

  await act20s();
  expect(mocked.clientReceipts).toHaveBeenCalledTimes(3);
});

test("never polls when nothing is pending from the start", async () => {
  mocked.clientReceipts.mockResolvedValue([analyzedReceipt()]);
  renderScreen();
  await waitFor(() => expect(mocked.clientReceipts).toHaveBeenCalledTimes(1));

  await act20s();
  expect(mocked.clientReceipts).toHaveBeenCalledTimes(1);
});
