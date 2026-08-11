import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import MuhasebecimScreen from "../muhasebecim";
import * as endpoints from "@/src/api/endpoints";
import type { GrantOut } from "@/src/api/endpoints";
import { createTestQueryClient } from "@/src/test/queryClient";

jest.mock("@/src/api/endpoints");

const mocked = endpoints as jest.Mocked<typeof endpoints>;

// Regression guard: the accountant's Mükellefler screen now mounts
// `GrantsSection` with `showActiveGrants={false}` so revoking moves to its
// own page (see `app/(accountant)/mukellefleri-yonet.tsx`). That prop
// defaults to `true`, and this screen doesn't pass it at all, so its
// rendering must stay exactly what it was before that split existed — an
// active accountant link still shows "Erişimi iptal et" inline, same as
// `fislik-web/src/pages/AccountantsPage.tsx`.
const activeAccountant: GrantOut = {
  id: "g1",
  status: "active",
  invited_email: "selin@muhasebe.com",
  accountant_name: null,
  direction: "outgoing",
  counterpart_name: "Selin Muhasebe",
  counterpart_email: "selin@muhasebe.com",
  invited_role: "accountant",
};

function renderScreen() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MuhasebecimScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("still shows the revoke control for an active accountant link", async () => {
  mocked.listGrants.mockResolvedValue([activeAccountant]);
  renderScreen();

  await waitFor(() => expect(screen.getByText("Selin Muhasebe")).toBeOnTheScreen());
  expect(screen.getByText("Erişimi iptal et")).toBeOnTheScreen();
});

test("still renders its own empty state when there are no grants", async () => {
  mocked.listGrants.mockResolvedValue([]);
  renderScreen();
  await waitFor(() => expect(screen.getByText("Henüz muhasebeci eklemedin")).toBeOnTheScreen());
});
