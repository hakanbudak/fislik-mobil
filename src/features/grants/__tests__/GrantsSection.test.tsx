import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { GrantsSection } from "../GrantsSection";
import * as endpoints from "@/src/api/endpoints";
import type { GrantOut } from "@/src/api/endpoints";
import { ApiError } from "@/src/api/client";
import { createTestQueryClient } from "@/src/test/queryClient";

jest.mock("@/src/api/endpoints");

const mocked = endpoints as jest.Mocked<typeof endpoints>;

function renderSection(role: "client" | "accountant" = "client") {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <GrantsSection role={role} />
    </QueryClientProvider>,
  );
}

const incomingPendingForClient: GrantOut = {
  id: "g1",
  status: "pending",
  invited_email: "client@test.com",
  accountant_name: null,
  direction: "incoming",
  counterpart_name: "Deniz Mali Müşavirlik",
  counterpart_email: "deniz@test.com",
  invited_role: "client",
};

const outgoingActive: GrantOut = {
  id: "g2",
  status: "active",
  invited_email: "selin@muhasebe.com",
  accountant_name: null,
  direction: "outgoing",
  counterpart_name: "Selin Muhasebe",
  counterpart_email: "selin@muhasebe.com",
  invited_role: "accountant",
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("separates incoming pending invites from the user's own grants", async () => {
  mocked.listGrants.mockResolvedValue([incomingPendingForClient, outgoingActive]);
  renderSection("client");

  await waitFor(() => expect(screen.getByText("Kabul Et")).toBeOnTheScreen());
  expect(screen.queryAllByText("Erişimi kaldır")).toHaveLength(1);
});

test("labels the invite field for a client inviting an accountant", async () => {
  mocked.listGrants.mockResolvedValue([]);
  renderSection("client");
  await waitFor(() => expect(screen.getByLabelText("Mali müşavir e-postası")).toBeOnTheScreen());
});

test("labels the invite field for an accountant inviting a client", async () => {
  mocked.listGrants.mockResolvedValue([]);
  renderSection("accountant");
  await waitFor(() => expect(screen.getByLabelText("Mükellef e-postası")).toBeOnTheScreen());
});

test("sends an invite and invalidates the grants list", async () => {
  mocked.listGrants.mockResolvedValue([]);
  mocked.inviteCounterpart.mockResolvedValue(outgoingActive);
  renderSection("client");

  await waitFor(() => expect(screen.getByLabelText("Mali müşavir e-postası")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Mali müşavir e-postası"), "yeni@muhasebe.com");
  fireEvent.press(screen.getByText("Davet Gönder"));

  await waitFor(() => expect(mocked.inviteCounterpart).toHaveBeenCalledWith("yeni@muhasebe.com"));
  await waitFor(() => expect(mocked.listGrants).toHaveBeenCalledTimes(2));
});

test("accepts an incoming invite and invalidates the grants list", async () => {
  mocked.listGrants.mockResolvedValue([incomingPendingForClient]);
  mocked.acceptGrant.mockResolvedValue({ ...incomingPendingForClient, status: "active" });
  renderSection("client");

  await waitFor(() => expect(screen.getByText("Kabul Et")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Kabul Et"));

  await waitFor(() => expect(mocked.acceptGrant).toHaveBeenCalledWith("g1"));
  await waitFor(() => expect(mocked.listGrants).toHaveBeenCalledTimes(2));
});

test("declines an incoming invite", async () => {
  mocked.listGrants.mockResolvedValue([incomingPendingForClient]);
  mocked.declineGrant.mockResolvedValue(undefined);
  renderSection("client");

  await waitFor(() => expect(screen.getByText("Reddet")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Reddet"));

  await waitFor(() => expect(mocked.declineGrant).toHaveBeenCalledWith("g1"));
});

test("revoking access is behind a confirmation that names the counterpart", async () => {
  mocked.listGrants.mockResolvedValue([outgoingActive]);
  mocked.revokeGrant.mockResolvedValue(undefined);
  renderSection("client");

  await waitFor(() => expect(screen.getByText("Erişimi kaldır")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Erişimi kaldır"));

  await waitFor(() => expect(screen.getByText(/Selin Muhasebe artık erişemeyecek/)).toBeOnTheScreen());
  expect(mocked.revokeGrant).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText("Vazgeç"));
  expect(screen.queryByText(/artık erişemeyecek/)).toBeNull();
});

test("confirming revoke calls the API and invalidates the grants list", async () => {
  mocked.listGrants.mockResolvedValue([outgoingActive]);
  mocked.revokeGrant.mockResolvedValue(undefined);
  renderSection("client");

  await waitFor(() => expect(screen.getByText("Erişimi kaldır")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Erişimi kaldır"));
  await waitFor(() => expect(screen.getByText(/Selin Muhasebe artık erişemeyecek/)).toBeOnTheScreen());

  const confirmButtons = screen.getAllByText("Erişimi kaldır");
  fireEvent.press(confirmButtons[confirmButtons.length - 1]);

  await waitFor(() => expect(mocked.revokeGrant).toHaveBeenCalledWith("g2"));
  await waitFor(() => expect(mocked.listGrants).toHaveBeenCalledTimes(2));
});

test("shows an empty state when there are no grants at all", async () => {
  mocked.listGrants.mockResolvedValue([]);
  renderSection("client");
  await waitFor(() => expect(screen.getByText("Henüz muhasebeci eklemedin")).toBeOnTheScreen());
});

test("shows an API error message for a failed invite, never the raw detail", async () => {
  mocked.listGrants.mockResolvedValue([]);
  mocked.inviteCounterpart.mockRejectedValue(new ApiError(409, "duplicate row xyz"));
  renderSection("client");

  await waitFor(() => expect(screen.getByLabelText("Mali müşavir e-postası")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Mali müşavir e-postası"), "yeni@muhasebe.com");
  fireEvent.press(screen.getByText("Davet Gönder"));

  await waitFor(() => expect(screen.getByText("Bu e-postaya zaten davet gönderilmiş")).toBeOnTheScreen());
  expect(screen.queryByText("duplicate row xyz")).toBeNull();
});
