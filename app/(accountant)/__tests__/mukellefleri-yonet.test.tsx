import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ManageClientsScreen from "../mukellefleri-yonet";
import * as endpoints from "@/src/api/endpoints";
import type { GrantOut } from "@/src/api/endpoints";
import { createTestQueryClient } from "@/src/test/queryClient";

jest.mock("@/src/api/endpoints");
jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));

const mocked = endpoints as jest.Mocked<typeof endpoints>;
const { router } = jest.requireMock("expo-router") as { router: { back: jest.Mock } };

const activeGrant: GrantOut = {
  id: "g1",
  status: "active",
  invited_email: "aktif@ornek.com",
  accountant_name: null,
  direction: "outgoing",
  counterpart_name: "Aktif Mükellef",
  counterpart_email: "aktif@ornek.com",
  invited_role: "client",
};

const outgoingPendingInvite: GrantOut = {
  id: "g2",
  status: "pending",
  invited_email: "bekleyen@ornek.com",
  accountant_name: null,
  direction: "outgoing",
  counterpart_name: null,
  counterpart_email: "bekleyen@ornek.com",
  invited_role: "client",
};

function renderScreen() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ManageClientsScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("lists active grants only, not pending outgoing invites", async () => {
  mocked.listGrants.mockResolvedValue([activeGrant, outgoingPendingInvite]);
  renderScreen();

  await waitFor(() => expect(screen.getByText("Aktif Mükellef")).toBeOnTheScreen());
  expect(screen.queryByText("bekleyen@ornek.com")).toBeNull();
});

test("revokes an active grant after confirmation", async () => {
  mocked.listGrants.mockResolvedValue([activeGrant]);
  mocked.revokeGrant.mockResolvedValue(undefined);
  renderScreen();

  await waitFor(() => expect(screen.getByText("Erişimi iptal et")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Erişimi iptal et"));
  await waitFor(() => expect(screen.getByText(/Aktif Mükellef artık fişlerinize erişemeyecek/)).toBeOnTheScreen());

  const confirmButtons = screen.getAllByText("Erişimi iptal et");
  fireEvent.press(confirmButtons[confirmButtons.length - 1]);

  await waitFor(() => expect(mocked.revokeGrant).toHaveBeenCalledWith("g1"));
});

test("shows an empty state when there are no active grants", async () => {
  mocked.listGrants.mockResolvedValue([]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Henüz mükellefiniz yok")).toBeOnTheScreen());
});

test("the back button navigates back", async () => {
  mocked.listGrants.mockResolvedValue([]);
  renderScreen();
  await waitFor(() => expect(screen.getByLabelText("Geri dön")).toBeOnTheScreen());
  fireEvent.press(screen.getByLabelText("Geri dön"));
  expect(router.back).toHaveBeenCalled();
});
