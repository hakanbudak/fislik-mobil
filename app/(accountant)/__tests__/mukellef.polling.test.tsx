import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react-native";
import ClientMonthScreen from "../(mukellefler)/mukellef/[clientId]";
import * as endpoints from "@/src/api/endpoints";
import type { CompanyOut, ReceiptOut } from "@/src/api/endpoints";
import { createTestQueryClient } from "@/src/test/queryClient";
import * as queue from "@/src/upload/queue";

/**
 * I2 (review follow-up): the client home screen's poll had a dedicated
 * test (app/(client)/__tests__/index.polling.test.tsx) but this screen's
 * — the accountant's per-client month view, the mobile counterpart of
 * fislik-web/src/pages/AccountantMonthPage.tsx — did not, even though this
 * bug was specifically a missing port. Same shape of test: poll every 5s
 * while any receipt is pending, stop once none are.
 */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@/src/upload/queue");
jest.mock("@/src/upload/worker", () => ({ drainOnce: jest.fn() }));
jest.mock("@/src/api/endpoints");
jest.mock("@/src/features/clients/downloadMonthZip", () => ({
  ...jest.requireActual("@/src/features/clients/downloadMonthZip"),
  downloadMonthZip: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({ clientId: "c1", period: "2026-08" }),
}));

const mocked = endpoints as jest.Mocked<typeof endpoints>;
const mockedQueue = queue as jest.Mocked<typeof queue>;

const company: CompanyOut = {
  full_name: "Ayşe Yıldırım",
  trade_name: "Yıldırım Ticaret",
  tax_office: "Kadıköy",
  tax_number: "1234567890",
  national_id: null,
  business_address: "İstanbul",
  tax_type: null,
  activity_code: null,
  activity_name: null,
  started_on: null,
  updated_at: "2026-01-01T00:00:00Z",
};

function pendingReceipt(): ReceiptOut {
  return {
    id: "r1",
    period: "2026-08",
    created_at: "2026-08-05T10:00:00Z",
    image_url: "https://example.com/r1.jpg",
    content_type: "image/jpeg",
    processed: false,
    open_issue: null,
    uploaded_by: null,
    extraction: { status: "pending" } as never,
  };
}

function analyzedReceipt(): ReceiptOut {
  return { ...pendingReceipt(), extraction: { status: "done", merchant_name: "Migros" } as never };
}

function renderScreen() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ClientMonthScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mocked.getClientCompany.mockResolvedValue(company);
  mocked.periodLockStatus.mockResolvedValue({ locked: false, locked_at: null });
  mockedQueue.listQueue.mockResolvedValue([]);
  mockedQueue.subscribe.mockReturnValue(() => undefined);
  mocked.getCredits.mockResolvedValue({ limit: null, used: 0, remaining: null, unlimited: true });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test("polls every 5s while a receipt is still being analyzed, and stops once it resolves", async () => {
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
