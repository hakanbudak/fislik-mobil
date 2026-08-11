import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AccountantClientsScreen from "../index";
import * as endpoints from "@/src/api/endpoints";
import type { ClientSummaryOut, GrantOut } from "@/src/api/endpoints";
import { createTestQueryClient } from "@/src/test/queryClient";

jest.mock("@/src/api/endpoints");
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

const mocked = endpoints as jest.Mocked<typeof endpoints>;
const { router } = jest.requireMock("expo-router") as { router: { push: jest.Mock } };

const client: ClientSummaryOut = {
  client_id: "c1",
  full_name: "Ayşe Yıldırım",
  receipt_count: 12,
  unprocessed_count: 3,
  last_upload_at: "2026-08-05T10:00:00Z",
};

const incomingInvite: GrantOut = {
  id: "g1",
  status: "pending",
  invited_email: "muhasebeci@test.com",
  accountant_name: null,
  direction: "incoming",
  counterpart_name: "Deniz Ticaret",
  counterpart_email: "deniz@test.com",
  invited_role: "accountant",
};

const outgoingPendingInvite: GrantOut = {
  id: "g2",
  status: "pending",
  invited_email: "yeni@ornek.com",
  accountant_name: null,
  direction: "outgoing",
  counterpart_name: null,
  counterpart_email: "yeni@ornek.com",
  invited_role: "client",
};

const activeGrant: GrantOut = {
  id: "g3",
  status: "active",
  invited_email: "aktif@ornek.com",
  accountant_name: null,
  direction: "outgoing",
  counterpart_name: "Aktif Mükellef",
  counterpart_email: "aktif@ornek.com",
  invited_role: "client",
};

function renderScreen() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AccountantClientsScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.listGrants.mockResolvedValue([]);
});

test("lists a client with its unprocessed count", async () => {
  mocked.listClients.mockResolvedValue([client]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Ayşe Yıldırım")).toBeOnTheScreen());
  expect(screen.getByText("12 fiş")).toBeOnTheScreen();
  expect(screen.getByText("3 işlenmemiş")).toBeOnTheScreen();
});

test("omits the unprocessed badge at zero", async () => {
  mocked.listClients.mockResolvedValue([{ ...client, unprocessed_count: 0 }]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Ayşe Yıldırım")).toBeOnTheScreen());
  expect(screen.queryByText(/işlenmemiş/)).toBeNull();
});

test("shows the empty state when there are no clients", async () => {
  mocked.listClients.mockResolvedValue([]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Henüz mükellefiniz yok")).toBeOnTheScreen());
});

test("renders exactly one empty state when both grants and clients are empty", async () => {
  mocked.listClients.mockResolvedValue([]);
  mocked.listGrants.mockResolvedValue([]);
  renderScreen();
  // GrantsSection is mounted with showEmptyState={false} on this screen, so
  // its own "no grants at all" empty state must not also render — only the
  // client list's does, matching AccountantClientsPage.tsx's single empty
  // state for the whole page.
  await waitFor(() => expect(screen.getAllByText("Henüz mükellefiniz yok")).toHaveLength(1));
});

test("shows an incoming invitation", async () => {
  mocked.listClients.mockResolvedValue([]);
  mocked.listGrants.mockResolvedValue([incomingInvite]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Kabul Et")).toBeOnTheScreen());
});

test("navigates to the client's month view with the current period and the client's name", async () => {
  mocked.listClients.mockResolvedValue([client]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Ayşe Yıldırım")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Ayşe Yıldırım"));
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/(accountant)/mukellef/[clientId]",
    params: { clientId: "c1", period: expect.any(String), full_name: "Ayşe Yıldırım" },
  });
});

test("does not render a revoke control for an active grant — that moved to Mükellefleri yönet", async () => {
  mocked.listClients.mockResolvedValue([client]);
  mocked.listGrants.mockResolvedValue([activeGrant]);
  renderScreen();

  await waitFor(() => expect(screen.getByText("Ayşe Yıldırım")).toBeOnTheScreen());
  expect(screen.queryByText("Aktif Mükellef")).toBeNull();
  expect(screen.queryByText("Erişimi iptal et")).toBeNull();
});

test("still shows the accountant's own outgoing pending invite", async () => {
  mocked.listClients.mockResolvedValue([]);
  mocked.listGrants.mockResolvedValue([outgoingPendingInvite]);
  renderScreen();

  await waitFor(() => expect(screen.getByText("yeni@ornek.com")).toBeOnTheScreen());
  expect(screen.getByText("Bekliyor")).toBeOnTheScreen();
});

test("navigates to Mükellefleri yönet", async () => {
  mocked.listClients.mockResolvedValue([]);
  renderScreen();

  await waitFor(() => expect(screen.getByText("Mükellefleri yönet")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Mükellefleri yönet"));
  expect(router.push).toHaveBeenCalledWith("/(accountant)/mukellefleri-yonet");
});
