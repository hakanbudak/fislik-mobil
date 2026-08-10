import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ReceiptDetailScreen from "../fis/[id]";
import { ApiError } from "@/src/api/client";
import * as endpoints from "@/src/api/endpoints";
import type { ReceiptOut } from "@/src/api/endpoints";
import { createTestQueryClient } from "@/src/test/queryClient";

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

const baseReceipt: ReceiptOut = {
  id: "r1",
  period: "2026-08",
  created_at: "2026-08-05T10:00:00Z",
  image_url: "https://r2/r1.jpg",
  content_type: "image/jpeg",
  processed: false,
  open_issue: null,
  uploaded_by: null,
  extraction,
};

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
  mocked.periodLockStatus.mockResolvedValue({ locked: false, locked_at: null });
  mocked.listReceipts.mockResolvedValue([baseReceipt]);
});

test("blocks editing and deletion when the month is locked", async () => {
  mocked.periodLockStatus.mockResolvedValue({ locked: true, locked_at: "2026-09-01T00:00:00Z" });
  renderScreen();
  await waitFor(() => expect(screen.getByText(/kapatıldı/)).toBeOnTheScreen());
  expect(screen.queryByText("Fişi sil")).toBeNull();
  expect(screen.queryByText("Ayı değiştir")).toBeNull();
});

test("confirms before deleting", async () => {
  renderScreen();
  await waitFor(() => expect(screen.getByText("Fişi sil")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Fişi sil"));
  expect(screen.getByText("Bu fiş silinecek. Emin misiniz?")).toBeOnTheScreen();
  expect(mocked.deleteReceipt).not.toHaveBeenCalled();
});

test("warns when the receipt's own date falls outside the filed month", async () => {
  mocked.listReceipts.mockResolvedValue([
    { ...baseReceipt, extraction: { ...extraction, receipt_date: "2026-07-28" } },
  ]);
  renderScreen();
  await waitFor(() => expect(screen.getByText(/Temmuz 2026 tarihli/)).toBeOnTheScreen());
});

test("shows a not-found empty state when the receipt is missing from the refetched list", async () => {
  mocked.listReceipts.mockResolvedValue([]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Fiş bulunamadı")).toBeOnTheScreen());
});

test("deletes the receipt after confirming and invalidates both caches", async () => {
  mocked.deleteReceipt.mockResolvedValue(undefined);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Fişi sil")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Fişi sil"));
  fireEvent.press(screen.getByText("Sil"));
  await waitFor(() => expect(mocked.deleteReceipt).toHaveBeenCalledWith("r1"));
});

test("changing the period invalidates both the old and new month", async () => {
  mocked.changePeriod.mockResolvedValue({ ...baseReceipt, period: "2026-09" });
  renderScreen();
  await waitFor(() => expect(screen.getByText("Ayı değiştir")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Ayı değiştir"));
  await waitFor(() => expect(screen.getByLabelText("Önceki ay")).toBeOnTheScreen());
  fireEvent.press(screen.getByLabelText("Önceki ay"));
  fireEvent.press(screen.getByText("Onayla"));
  await waitFor(() => expect(mocked.changePeriod).toHaveBeenCalledWith("r1", "2026-07"));
});

test("shows a specific message when retry 409s because the receipt was hand-edited", async () => {
  mocked.listReceipts.mockResolvedValue([
    { ...baseReceipt, extraction: { ...extraction, status: "failed" } },
  ]);
  mocked.retryExtraction.mockRejectedValue(new ApiError(409, "Extraction was manually edited"));
  renderScreen();
  await waitFor(() => expect(screen.getByText("Yeniden dene")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Yeniden dene"));
  await waitFor(() =>
    expect(screen.getByText("Bu fiş elle düzenlendiği için yeniden analiz edilemez.")).toBeOnTheScreen(),
  );
  expect(screen.queryByText("Bu işlem zaten yapılmış.")).toBeNull();
});

test("shows the open-issue card when the receipt has one", async () => {
  mocked.listReceipts.mockResolvedValue([
    {
      ...baseReceipt,
      open_issue: { id: "i1", message: "Tutar okunamıyor", author_name: "Muhasebeci Ayşe", created_at: "2026-08-06T10:00:00Z" },
    },
  ]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Tutar okunamıyor")).toBeOnTheScreen());
});

test("resolves the open issue, clearing the card and invalidating the period", async () => {
  mocked.listReceipts.mockResolvedValue([
    {
      ...baseReceipt,
      open_issue: { id: "i1", message: "Tutar okunamıyor", author_name: "Muhasebeci Ayşe", created_at: "2026-08-06T10:00:00Z" },
    },
  ]);
  mocked.resolveIssue.mockResolvedValue(undefined);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Tutar okunamıyor")).toBeOnTheScreen());

  fireEvent.press(screen.getByText("Çözüldü olarak işaretle"));

  await waitFor(() => expect(mocked.resolveIssue).toHaveBeenCalledWith("i1"));
  expect(screen.queryByText("Tutar okunamıyor")).toBeNull();
  expect(screen.queryByText("Çözüldü olarak işaretle")).toBeNull();
});
