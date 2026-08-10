import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ClientMonthScreen from "../mukellef/[clientId]";
import * as endpoints from "@/src/api/endpoints";
import type { CompanyOut, ReceiptOut } from "@/src/api/endpoints";
import { queryKeys } from "@/src/api/queryKeys";
import { createTestQueryClient } from "@/src/test/queryClient";

jest.mock("@/src/api/endpoints");
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

const mocked = endpoints as jest.Mocked<typeof endpoints>;
const { router, useLocalSearchParams } = jest.requireMock("expo-router") as {
  router: { push: jest.Mock; back: jest.Mock; setParams: jest.Mock };
  useLocalSearchParams: jest.Mock;
};

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

function receipt(overrides: Partial<ReceiptOut> = {}): ReceiptOut {
  return {
    id: "r1",
    period: "2026-08",
    created_at: "2026-08-05T10:00:00Z",
    image_url: "https://example.com/r1.jpg",
    content_type: "image/jpeg",
    processed: false,
    open_issue: null,
    extraction: null,
    uploaded_by: null,
    ...overrides,
  };
}

function renderScreen() {
  const queryClient = createTestQueryClient();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ClientMonthScreen />
    </QueryClientProvider>,
  );
  return { queryClient, ...utils };
}

beforeEach(() => {
  jest.clearAllMocks();
  useLocalSearchParams.mockReturnValue({ clientId: "c1", period: "2026-08" });
  mocked.getClientCompany.mockResolvedValue(company);
  mocked.periodLockStatus.mockResolvedValue({ locked: false, locked_at: null });
});

test("shows the client's name and month picker", async () => {
  mocked.clientReceipts.mockResolvedValue([]);
  renderScreen();
  await waitFor(() => expect(screen.getAllByText("Yıldırım Ticaret").length).toBeGreaterThan(0));
  expect(screen.getByText("Ağustos 2026")).toBeOnTheScreen();
});

test("expands the company card to show full details on tap", async () => {
  mocked.clientReceipts.mockResolvedValue([]);
  renderScreen();
  await waitFor(() => expect(screen.getByLabelText("Firma bilgilerini göster")).toBeOnTheScreen());
  expect(screen.queryByText("İş Yeri Adresi")).toBeNull();
  fireEvent.press(screen.getByLabelText("Firma bilgilerini göster"));
  expect(screen.getByText("İş Yeri Adresi")).toBeOnTheScreen();
  expect(screen.getByText("İstanbul")).toBeOnTheScreen();
});

test("shows the empty state when the client has no receipts this month", async () => {
  mocked.clientReceipts.mockResolvedValue([]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Bu ay fiş yok")).toBeOnTheScreen());
});

test("shows the passed client name immediately, without waiting for the company query", async () => {
  mocked.clientReceipts.mockResolvedValue([]);
  // Never resolves — proves the header doesn't wait on this query at all.
  mocked.getClientCompany.mockReturnValue(new Promise(() => {}));
  useLocalSearchParams.mockReturnValue({ clientId: "c1", period: "2026-08", full_name: "Deniz Ticaret" });
  renderScreen();
  expect(screen.getByText("Deniz Ticaret")).toBeOnTheScreen();
  // Let the (resolved) receipts query settle too, so its state update lands
  // inside this test's act() scope instead of leaking into the next one.
  await waitFor(() => expect(mocked.clientReceipts).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText("Bu ay fiş yok")).toBeOnTheScreen());
});

test("shows 'Tümünü işlendi yap' when any receipt is unprocessed", async () => {
  mocked.clientReceipts.mockResolvedValue([receipt({ processed: false })]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Tümünü işlendi yap")).toBeOnTheScreen());
});

test("shows 'Tümünün işaretini kaldır' when every receipt is processed", async () => {
  mocked.clientReceipts.mockResolvedValue([receipt({ processed: true })]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Tümünün işaretini kaldır")).toBeOnTheScreen());
});

test("bulk-marks every receipt processed and invalidates both query keys", async () => {
  mocked.clientReceipts.mockResolvedValue([receipt({ processed: false })]);
  mocked.bulkMarkProcessed.mockResolvedValue({ marked: 1 });
  const { queryClient } = renderScreen();
  await waitFor(() => expect(screen.getByText("Tümünü işlendi yap")).toBeOnTheScreen());
  const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

  fireEvent.press(screen.getByText("Tümünü işlendi yap"));

  await waitFor(() => expect(mocked.bulkMarkProcessed).toHaveBeenCalledWith("c1", "2026-08"));
  await waitFor(() =>
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.clientReceipts("c1", "2026-08") }),
    ),
  );
  expect(invalidateSpy).toHaveBeenCalledWith(
    expect.objectContaining({ queryKey: queryKeys.clients("2026-08") }),
  );
});

test("bulk-unmarks every receipt when all are already processed", async () => {
  mocked.clientReceipts.mockResolvedValue([receipt({ processed: true })]);
  mocked.bulkUnmarkProcessed.mockResolvedValue({ unmarked: 1 });
  renderScreen();
  await waitFor(() => expect(screen.getByText("Tümünün işaretini kaldır")).toBeOnTheScreen());

  fireEvent.press(screen.getByText("Tümünün işaretini kaldır"));

  await waitFor(() => expect(mocked.bulkUnmarkProcessed).toHaveBeenCalledWith("c1", "2026-08"));
});

test("shows an error toast when the bulk action fails", async () => {
  mocked.clientReceipts.mockResolvedValue([receipt({ processed: false })]);
  mocked.bulkMarkProcessed.mockRejectedValue(new Error("boom"));
  renderScreen();
  await waitFor(() => expect(screen.getByText("Tümünü işlendi yap")).toBeOnTheScreen());

  fireEvent.press(screen.getByText("Tümünü işlendi yap"));

  await waitFor(() => expect(screen.getByText("Bir şeyler ters gitti. Lütfen tekrar dene.")).toBeOnTheScreen());
});

test("long-pressing a single receipt toggles its processed mark", async () => {
  mocked.clientReceipts.mockResolvedValue([receipt({ id: "r1", processed: false })]);
  mocked.markProcessed.mockResolvedValue(undefined);
  const { queryClient } = renderScreen();
  await waitFor(() => expect(screen.getByLabelText("Fiş")).toBeOnTheScreen());
  const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

  fireEvent(screen.getByLabelText("Fiş"), "longPress");

  await waitFor(() => expect(mocked.markProcessed).toHaveBeenCalledWith("c1", "r1"));
  await waitFor(() =>
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.clientReceipts("c1", "2026-08") }),
    ),
  );
  expect(invalidateSpy).toHaveBeenCalledWith(
    expect.objectContaining({ queryKey: queryKeys.clients("2026-08") }),
  );
});

test("hints that a long press toggles a single receipt", async () => {
  mocked.clientReceipts.mockResolvedValue([receipt()]);
  renderScreen();
  await waitFor(() => expect(screen.getByText(/uzun bas/i)).toBeOnTheScreen());
});

test("tapping a receipt pushes to the accountant's receipt detail route", async () => {
  mocked.clientReceipts.mockResolvedValue([receipt({ id: "r7", period: "2026-08" })]);
  renderScreen();
  await waitFor(() => expect(screen.getByLabelText("Fiş")).toBeOnTheScreen());

  fireEvent.press(screen.getByLabelText("Fiş"));

  expect(router.push).toHaveBeenCalledWith({
    pathname: "/(accountant)/mukellef/[clientId]/fis/[id]",
    params: { clientId: "c1", id: "r7", period: "2026-08" },
  });
});

test("changing the month updates the route param instead of local state", async () => {
  mocked.clientReceipts.mockResolvedValue([]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Ağustos 2026")).toBeOnTheScreen());

  fireEvent.press(screen.getByLabelText("Önceki ay"));

  expect(router.setParams).toHaveBeenCalledWith({ period: "2026-07" });
});

describe("month locking", () => {
  test("shows 'Ayı Kapat' when the month is unlocked, and requires confirmation before calling the endpoint", async () => {
    mocked.clientReceipts.mockResolvedValue([]);
    mocked.lockPeriod.mockResolvedValue({ locked: true, locked_at: "2026-08-10T00:00:00Z" });
    renderScreen();
    await waitFor(() => expect(screen.getByText("Ayı Kapat")).toBeOnTheScreen());

    fireEvent.press(screen.getByText("Ayı Kapat"));
    // Not called yet — pressing the action only opens the confirmation.
    expect(mocked.lockPeriod).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Vazgeç"));
    expect(screen.queryByText(/kapatılsın mı/)).toBeNull();

    fireEvent.press(screen.getByText("Ayı Kapat"));
    await waitFor(() => expect(screen.getByText(/kapatılsın mı/)).toBeOnTheScreen());
    fireEvent.press(screen.getByText("Ayı Kapat"));

    await waitFor(() => expect(mocked.lockPeriod).toHaveBeenCalledWith("c1", "2026-08"));
  });

  test("locking invalidates the period-lock query", async () => {
    mocked.clientReceipts.mockResolvedValue([]);
    mocked.lockPeriod.mockResolvedValue({ locked: true, locked_at: "2026-08-10T00:00:00Z" });
    const { queryClient } = renderScreen();
    await waitFor(() => expect(screen.getByText("Ayı Kapat")).toBeOnTheScreen());
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    fireEvent.press(screen.getByText("Ayı Kapat"));
    await waitFor(() => expect(screen.getByText(/kapatılsın mı/)).toBeOnTheScreen());
    fireEvent.press(screen.getByText("Ayı Kapat"));

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.periodLock("2026-08", "c1") }),
      ),
    );
  });

  test("shows the locked indicator and an unlock control when the month is locked, calling the endpoint without confirmation", async () => {
    mocked.clientReceipts.mockResolvedValue([]);
    mocked.periodLockStatus.mockResolvedValue({ locked: true, locked_at: "2026-08-01T00:00:00Z" });
    mocked.unlockPeriod.mockResolvedValue(undefined);
    const { queryClient } = renderScreen();
    await waitFor(() => expect(screen.getByText("Ay kapalı — Aç")).toBeOnTheScreen());
    expect(screen.queryByText("Ayı Kapat")).toBeNull();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    fireEvent.press(screen.getByText("Ay kapalı — Aç"));

    await waitFor(() => expect(mocked.unlockPeriod).toHaveBeenCalledWith("c1", "2026-08"));
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.periodLock("2026-08", "c1") }),
      ),
    );
  });

  test("shows an error toast when locking fails", async () => {
    mocked.clientReceipts.mockResolvedValue([]);
    mocked.lockPeriod.mockRejectedValue(new Error("boom"));
    renderScreen();
    await waitFor(() => expect(screen.getByText("Ayı Kapat")).toBeOnTheScreen());

    fireEvent.press(screen.getByText("Ayı Kapat"));
    await waitFor(() => expect(screen.getByText(/kapatılsın mı/)).toBeOnTheScreen());
    fireEvent.press(screen.getByText("Ayı Kapat"));

    await waitFor(() => expect(screen.getByText("Bir şeyler ters gitti. Lütfen tekrar dene.")).toBeOnTheScreen());
  });
});
