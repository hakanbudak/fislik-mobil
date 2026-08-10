import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import { NotificationTabIcon } from "../NotificationTabIcon";
import * as endpoints from "@/src/api/endpoints";
import { queryKeys } from "@/src/api/queryKeys";
import { createTestQueryClient } from "@/src/test/queryClient";

jest.mock("@/src/api/endpoints");

const mocked = endpoints as jest.Mocked<typeof endpoints>;

function renderIcon() {
  const client = createTestQueryClient();
  render(
    <QueryClientProvider client={client}>
      <NotificationTabIcon color="#000" size={20} />
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => jest.clearAllMocks());

test("shows no badge when there is nothing unread", async () => {
  mocked.listNotifications.mockResolvedValue({ unread_count: 0, items: [] });
  const client = renderIcon();
  await waitFor(() => expect(client.getQueryData(queryKeys.notifications())).toBeDefined());
  expect(screen.queryByText("0")).toBeNull();
});

test("shows the unread count", async () => {
  mocked.listNotifications.mockResolvedValue({ unread_count: 3, items: [] });
  renderIcon();
  await waitFor(() => expect(screen.getByText("3")).toBeOnTheScreen());
});

test("caps the badge at 9+", async () => {
  mocked.listNotifications.mockResolvedValue({ unread_count: 42, items: [] });
  renderIcon();
  await waitFor(() => expect(screen.getByText("9+")).toBeOnTheScreen());
});
