import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react-native";
import HomeScreen from "../(fisler)/index";
import * as endpoints from "@/src/api/endpoints";
import { createTestQueryClient } from "@/src/test/queryClient";

/**
 * Bug: a receipt stuck "analiz ediliyor" never updated on its own — only
 * navigating into the detail screen and back refreshed it. The fix ports
 * fislik-web/src/pages/ClientHomePage.tsx's conditional
 * `refetchInterval`: poll every 5s while ANY receipt in the list has
 * `extraction?.status === "pending"`, and stop polling (resolve to `false`)
 * the instant nothing is pending anymore — a poll that keeps running once
 * nothing is pending drains battery and hammers the API on a phone.
 *
 * Fake timers are used because `refetchInterval` schedules real
 * `setInterval`/`setTimeout` calls under the hood; `afterEach` restores real
 * timers unconditionally so a failing assertion can never leave fake timers
 * leaked into a later test file.
 */
jest.mock("@/src/api/endpoints");
jest.mock("expo-router", () => ({ router: { push: jest.fn() }, Link: ({ children }: never) => children }));
jest.mock("@/src/upload/useUploadQueue", () => ({
  useUploadQueue: () => ({ queued: [], retry: jest.fn(), discard: jest.fn() }),
}));

const mocked = endpoints as jest.Mocked<typeof endpoints>;

function renderScreen() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <HomeScreen />
    </QueryClientProvider>,
  );
}

function pendingReceipt() {
  return {
    id: "r1",
    period: "2026-08",
    created_at: "2026-08-05T10:00:00Z",
    image_url: "https://r2/r1.jpg",
    processed: false,
    open_issue: null,
    uploaded_by: null,
    extraction: { status: "pending" },
  };
}

function analyzedReceipt() {
  return { ...pendingReceipt(), extraction: { status: "done", merchant_name: "Migros" } };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mocked.periodLockStatus.mockResolvedValue({ locked: false, locked_at: null });
  mocked.getSubmissionState.mockResolvedValue({
    last_sent_at: null,
    can_send: true,
    active_receipt_count: 1,
    has_accountant: true,
  });
  mocked.receiptsSummary.mockResolvedValue({
    receipt_count: 1,
    analyzed_count: 0,
    total_amount: "0",
    vat_total: "0",
    vat_by_rate: {},
  } as never);
});

afterEach(() => {
  jest.useRealTimers();
});

test("polls every 5s while a receipt is still being analyzed, and stops once it resolves", async () => {
  mocked.listReceipts.mockResolvedValueOnce([pendingReceipt()] as never);
  renderScreen();

  await waitFor(() => expect(mocked.listReceipts).toHaveBeenCalledTimes(1));

  // Still pending: the next 5s tick must trigger a second fetch.
  mocked.listReceipts.mockResolvedValueOnce([pendingReceipt()] as never);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000);
  });
  await waitFor(() => expect(mocked.listReceipts).toHaveBeenCalledTimes(2));

  // This fetch resolves the extraction — polling must stop here.
  mocked.listReceipts.mockResolvedValueOnce([analyzedReceipt()] as never);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000);
  });
  await waitFor(() => expect(mocked.listReceipts).toHaveBeenCalledTimes(3));

  // No further ticks: another 5s (in fact several) must not trigger a 4th
  // call — this is what pins `refetchInterval` actually resolving to
  // `false`, not just "happens not to have fired yet".
  await act(async () => {
    await jest.advanceTimersByTimeAsync(20000);
  });
  expect(mocked.listReceipts).toHaveBeenCalledTimes(3);
});

test("never polls when nothing is pending from the start", async () => {
  mocked.listReceipts.mockResolvedValue([analyzedReceipt()] as never);
  renderScreen();

  await waitFor(() => expect(mocked.listReceipts).toHaveBeenCalledTimes(1));

  await act(async () => {
    await jest.advanceTimersByTimeAsync(20000);
  });
  expect(mocked.listReceipts).toHaveBeenCalledTimes(1);
});
