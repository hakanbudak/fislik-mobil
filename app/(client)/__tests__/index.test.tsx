import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import HomeScreen from "../index";
import * as endpoints from "@/src/api/endpoints";
import { currentPeriod, shiftPeriod } from "@/src/lib/period";
import { createTestQueryClient } from "@/src/test/queryClient";

jest.mock("@/src/api/endpoints");
jest.mock("expo-router", () => ({ router: { push: jest.fn() }, Link: ({ children }: never) => children }));
jest.mock("@/src/upload/useUploadQueue", () => ({
  useUploadQueue: () => ({ queued: [], retry: jest.fn(), discard: jest.fn() }),
}));

const mocked = endpoints as jest.Mocked<typeof endpoints>;

const summary = {
  receipt_count: 2,
  analyzed_count: 2,
  total_amount: "1234.50",
  vat_total: "185.18",
  vat_by_rate: { "20": "185.18" },
};

function renderScreen() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <HomeScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.periodLockStatus.mockResolvedValue({ locked: false, locked_at: null });
  mocked.getSubmissionState.mockResolvedValue({
    last_sent_at: null,
    can_send: true,
    active_receipt_count: 2,
    has_accountant: true,
  });
});

test("shows the monthly summary and the receipts", async () => {
  mocked.receiptsSummary.mockResolvedValue(summary as never);
  mocked.listReceipts.mockResolvedValue([
    {
      id: "r1",
      period: "2026-08",
      created_at: "2026-08-05T10:00:00Z",
      image_url: "https://r2/r1.jpg",
      processed: false,
      open_issue: null,
      uploaded_by: null,
    },
  ] as never);
  renderScreen();
  await waitFor(() => expect(screen.getByText("₺1.234,50")).toBeOnTheScreen());
});

test("shows an empty state when the month has no receipts", async () => {
  mocked.receiptsSummary.mockResolvedValue({ ...summary, receipt_count: 0, total_amount: "0" } as never);
  mocked.listReceipts.mockResolvedValue([]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Bu ay için henüz fiş yok")).toBeOnTheScreen());
});

test("warns when the month is locked", async () => {
  mocked.periodLockStatus.mockResolvedValue({ locked: true, locked_at: "2026-09-01T00:00:00Z" });
  mocked.receiptsSummary.mockResolvedValue(summary as never);
  mocked.listReceipts.mockResolvedValue([]);
  renderScreen();
  await waitFor(() =>
    expect(screen.getByText(/Bu ay muhasebeciniz tarafından kapatıldı/)).toBeOnTheScreen(),
  );
});

test("submits the picker's selected period, not just the initial one", async () => {
  mocked.receiptsSummary.mockResolvedValue(summary as never);
  mocked.listReceipts.mockResolvedValue([]);
  mocked.submitReceipts.mockResolvedValue({
    last_sent_at: "2026-08-10T12:00:00Z",
    can_send: false,
    active_receipt_count: 2,
    has_accountant: true,
  });
  renderScreen();
  await waitFor(() => expect(screen.getByText("Muhasebeciye gönder")).toBeOnTheScreen());

  // Move off the initial (current) period before submitting, so a button
  // wired to the picker's state is distinguishable from one hardcoded to
  // `currentPeriod()` — both would otherwise submit the same value.
  const shiftedPeriod = shiftPeriod(currentPeriod(), -1);
  fireEvent.press(screen.getByLabelText("Önceki ay"));
  await waitFor(() => expect(mocked.getSubmissionState).toHaveBeenCalledWith(shiftedPeriod));
  // Changing the period clears cached submission data until the refetch for
  // the new period resolves, so the row briefly unmounts — wait for it to
  // come back before pressing.
  await waitFor(() => expect(screen.getByText("Muhasebeciye gönder")).toBeOnTheScreen());

  fireEvent.press(screen.getByText("Muhasebeciye gönder"));
  await waitFor(() => expect(mocked.submitReceipts).toHaveBeenCalledWith(shiftedPeriod));
});

test("shows curated Turkish copy, not the raw detail, when submitting fails", async () => {
  const { ApiError } = jest.requireActual("@/src/api/client");
  mocked.receiptsSummary.mockResolvedValue(summary as never);
  mocked.listReceipts.mockResolvedValue([]);
  mocked.submitReceipts.mockRejectedValue(new ApiError(409, "already submitted this period"));
  renderScreen();
  await waitFor(() => expect(screen.getByText("Muhasebeciye gönder")).toBeOnTheScreen());

  fireEvent.press(screen.getByText("Muhasebeciye gönder"));
  await waitFor(() => expect(screen.getByText("Bu işlem zaten yapılmış.")).toBeOnTheScreen());
  expect(screen.queryByText(/already submitted/)).toBeNull();
  // Settles the row/badge to the server's true state after the failure too.
  await waitFor(() => expect(mocked.getSubmissionState).toHaveBeenCalledTimes(2));
});

test("treats a 404 from the lock endpoint as not locked", async () => {
  const { ApiError } = jest.requireActual("@/src/api/client");
  mocked.periodLockStatus.mockRejectedValue(new ApiError(404, "Not Found"));
  mocked.receiptsSummary.mockResolvedValue(summary as never);
  mocked.listReceipts.mockResolvedValue([]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Bu ay için henüz fiş yok")).toBeOnTheScreen());
  expect(screen.queryByText(/kapatıldı/)).toBeNull();
});
