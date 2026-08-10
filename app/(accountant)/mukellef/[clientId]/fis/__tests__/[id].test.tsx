import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ReceiptDetailScreen from "../[id]";
import { ApiError } from "@/src/api/client";
import * as endpoints from "@/src/api/endpoints";
import type { ReceiptOut } from "@/src/api/endpoints";
import { createTestQueryClient } from "@/src/test/queryClient";

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
  mocked.clientReceipts.mockResolvedValue([baseReceipt]);
});

test("loads the receipt via clientReceipts, scoped to the client", async () => {
  renderScreen();
  await waitFor(() => expect(screen.getByLabelText("Fiş görseli")).toBeOnTheScreen());
  expect(mocked.clientReceipts).toHaveBeenCalledWith("c1", "2026-08");
});

test("shows a not-found empty state when the receipt is missing from the refetched list", async () => {
  mocked.clientReceipts.mockResolvedValue([]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Fiş bulunamadı")).toBeOnTheScreen());
});

test("shows a specific message when retry 409s because the receipt was hand-edited", async () => {
  mocked.clientReceipts.mockResolvedValue([{ ...baseReceipt, extraction: { ...extraction, status: "failed" } }]);
  mocked.retryExtraction.mockRejectedValue(new ApiError(409, "Extraction was manually edited"));
  renderScreen();
  await waitFor(() => expect(screen.getByText("Yeniden dene")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Yeniden dene"));
  await waitFor(() =>
    expect(screen.getByText("Bu fiş elle düzenlendiği için yeniden analiz edilemez.")).toBeOnTheScreen(),
  );
  expect(screen.queryByText("Bu işlem zaten yapılmış.")).toBeNull();
});

test("saving a patch invalidates the client's receipt list", async () => {
  mocked.patchExtraction.mockResolvedValue({ ...extraction });
  renderScreen();
  await waitFor(() => expect(screen.getByDisplayValue("Migros")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Satıcı"), "Migros Jet");
  fireEvent.press(screen.getByText("Kaydet"));
  await waitFor(() => expect(mocked.patchExtraction).toHaveBeenCalledWith("r1", { merchant_name: "Migros Jet" }));
  await waitFor(() => expect(mocked.clientReceipts).toHaveBeenCalledTimes(2));
});

test("reporting an issue sends the typed message and invalidates the client's receipt list", async () => {
  mocked.openIssue.mockResolvedValue({
    id: "i1",
    message: "Bu fiş okunamıyor",
    author_name: "Muhasebeci",
    created_at: "2026-08-06T10:00:00Z",
  });
  renderScreen();
  await waitFor(() => expect(screen.getByText("Sorun bildir")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Sorun bildir"));
  fireEvent.changeText(screen.getByLabelText("Sorun mesajı"), "Bu fiş okunamıyor");
  fireEvent.press(screen.getByText("Sorunu gönder"));
  await waitFor(() => expect(mocked.openIssue).toHaveBeenCalledWith("c1", "r1", "Bu fiş okunamıyor"));
  await waitFor(() => expect(mocked.clientReceipts).toHaveBeenCalledTimes(2));
});

test("an empty issue message does not call openIssue", async () => {
  renderScreen();
  await waitFor(() => expect(screen.getByText("Sorun bildir")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Sorun bildir"));
  fireEvent.press(screen.getByText("Sorunu gönder"));
  expect(screen.getByText("Lütfen sorunu açıklayın")).toBeOnTheScreen();
  expect(mocked.openIssue).not.toHaveBeenCalled();
});

test("shows the open issue and resolves it, invalidating the client's receipt list", async () => {
  mocked.clientReceipts.mockResolvedValue([
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
  await waitFor(() => expect(mocked.clientReceipts).toHaveBeenCalledTimes(2));
});
