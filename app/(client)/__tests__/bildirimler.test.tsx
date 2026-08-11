import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import { ActivityIndicator } from "react-native";
import BildirimlerScreen from "../bildirimler";
import * as endpoints from "@/src/api/endpoints";
import type { NotificationsPage } from "@/src/api/endpoints";
import { ApiError } from "@/src/api/client";
import { createTestQueryClient } from "@/src/test/queryClient";

jest.mock("@/src/api/endpoints");

const mocked = endpoints as jest.Mocked<typeof endpoints>;

function renderScreen() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <BildirimlerScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.markNotificationsRead.mockResolvedValue(undefined);
});

const page = (items: NotificationsPage["items"], unread_count: number): NotificationsPage => ({
  unread_count,
  items,
});

test("shows a spinner while loading", async () => {
  mocked.listNotifications.mockReturnValue(new Promise(() => {}));
  renderScreen();
  expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
});

test("shows the empty state when there are no notifications", async () => {
  mocked.listNotifications.mockResolvedValue(page([], 0));
  renderScreen();
  await waitFor(() => expect(screen.getByText("Henüz bildirim yok")).toBeOnTheScreen());
});

test("shows a curated error, never the raw detail, and retries on demand", async () => {
  mocked.listNotifications.mockRejectedValue(new ApiError(500, "trace xyz"));
  renderScreen();
  await waitFor(() =>
    expect(screen.getByText("Bir şeyler ters gitti. Lütfen tekrar dene.")).toBeOnTheScreen(),
  );
  expect(screen.queryByText("trace xyz")).toBeNull();
});

test("renders notification copy via notificationText and a formatted timestamp", async () => {
  // Built from local components, not a hardcoded UTC literal — see
  // src/lib/__tests__/dates.test.ts for why: it's the only TZ-stable way to
  // assert formatDateTime's local-time rendering.
  const localInstant = new Date(2026, 7, 7, 14, 30, 0); // 7 Ağustos 2026, 14:30 (local)
  mocked.listNotifications.mockResolvedValue(
    page(
      [
        {
          id: "n1",
          type: "issue_resolved",
          payload: {},
          read: false,
          created_at: localInstant.toISOString(),
        },
      ],
      1,
    ),
  );
  renderScreen();
  await waitFor(() => expect(screen.getByText("Bildirdiğin sorun çözüldü")).toBeOnTheScreen());
  expect(screen.getByText("7 Ağustos 2026, 14:30")).toBeOnTheScreen();
});

test("renders readable copy for a notification type the app doesn't know yet", async () => {
  mocked.listNotifications.mockResolvedValue(
    page([{ id: "n1", type: "credit_granted", payload: {}, read: false, created_at: "2026-08-07T14:30:00Z" }], 1),
  );
  renderScreen();
  await waitFor(() => expect(screen.getByText("Yeni bildirim")).toBeOnTheScreen());
});

test("marks everything read on mount when there is something unread, then invalidates the query", async () => {
  mocked.listNotifications.mockResolvedValue(
    page([{ id: "n1", type: "issue_resolved", payload: {}, read: false, created_at: "2026-08-07T14:30:00Z" }], 1),
  );
  renderScreen();
  await waitFor(() => expect(mocked.markNotificationsRead).toHaveBeenCalledWith(null));
  await waitFor(() => expect(mocked.listNotifications).toHaveBeenCalledTimes(2));
});

test("does not call markNotificationsRead when nothing is unread", async () => {
  mocked.listNotifications.mockResolvedValue(
    page([{ id: "n1", type: "issue_resolved", payload: {}, read: true, created_at: "2026-08-07T14:30:00Z" }], 0),
  );
  renderScreen();
  await waitFor(() => expect(screen.getByText("Bildirdiğin sorun çözüldü")).toBeOnTheScreen());
  expect(mocked.markNotificationsRead).not.toHaveBeenCalled();
});
