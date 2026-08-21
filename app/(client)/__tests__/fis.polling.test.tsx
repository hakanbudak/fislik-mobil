import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react-native";
import ReceiptDetailScreen from "../(fisler)/fis/[id]";
import * as endpoints from "@/src/api/endpoints";
import type { ReceiptOut } from "@/src/api/endpoints";
import { createTestQueryClient } from "@/src/test/queryClient";

/**
 * I2 (review follow-up): the client home screen's poll had a dedicated
 * test but this screen's — the mobile counterpart of
 * fislik-web/src/pages/ReceiptDetailPage.tsx — did not. Unlike the list
 * screens, this one's predicate is scoped to the single receipt being
 * viewed (`r.id === id`), so it also has to prove a PENDING receipt that
 * ISN'T the one being viewed does not trigger a poll here.
 */
jest.mock("@/src/api/endpoints");
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: "r1", period: "2026-08" }),
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
  mocked.periodLockStatus.mockResolvedValue({ locked: false, locked_at: null });
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

test("polls every 5s while the VIEWED receipt is still being analyzed, and stops once it resolves", async () => {
  mocked.listReceipts.mockResolvedValueOnce([pendingReceipt()]);
  renderScreen();
  await waitFor(() => expect(mocked.listReceipts).toHaveBeenCalledTimes(1));

  mocked.listReceipts.mockResolvedValueOnce([pendingReceipt()]);
  await act5s();
  await waitFor(() => expect(mocked.listReceipts).toHaveBeenCalledTimes(2));

  mocked.listReceipts.mockResolvedValueOnce([analyzedReceipt()]);
  await act5s();
  await waitFor(() => expect(mocked.listReceipts).toHaveBeenCalledTimes(3));

  await act20s();
  expect(mocked.listReceipts).toHaveBeenCalledTimes(3);
});

test("does not poll for a different receipt's pending extraction — the predicate is scoped to the viewed id", async () => {
  mocked.listReceipts.mockResolvedValue([analyzedReceipt(), pendingReceipt({ id: "other" })]);
  renderScreen();
  await waitFor(() => expect(mocked.listReceipts).toHaveBeenCalledTimes(1));

  await act20s();
  expect(mocked.listReceipts).toHaveBeenCalledTimes(1);
});
