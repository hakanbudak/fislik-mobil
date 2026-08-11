import type { QueryClient } from "@tanstack/react-query";
import { invalidateAfterUpload } from "../invalidateAfterUpload";
import { queryKeys } from "@/src/api/queryKeys";
import type { ReceiptOut } from "@/src/api/endpoints";

function fakeQueryClient(): { invalidateQueries: jest.Mock } {
  return { invalidateQueries: jest.fn() };
}

function receipt(overrides: Partial<ReceiptOut> = {}): ReceiptOut {
  return { id: "r1", period: "2026-08", ...overrides } as ReceiptOut;
}

test("for the caller's own upload (no clientId), invalidates the client's own receipt queries", () => {
  const queryClient = fakeQueryClient();
  invalidateAfterUpload(queryClient as unknown as QueryClient, receipt({ period: "2026-08" }), "2026-08");

  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.receipts("2026-08") });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.summary("2026-08") });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.submission("2026-08") });
  expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith(
    expect.objectContaining({ queryKey: queryKeys.credits() }),
  );
});

test("for an accountant's on-behalf upload, invalidates that client's receipts, the client list, and the accountant's own credits", () => {
  const queryClient = fakeQueryClient();
  invalidateAfterUpload(queryClient as unknown as QueryClient, receipt({ period: "2026-08" }), "2026-08", "c1");

  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: queryKeys.clientReceipts("c1", "2026-08"),
  });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.clients("2026-08") });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.credits() });
  expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith(
    expect.objectContaining({ queryKey: queryKeys.receipts("2026-08") }),
  );
});

test("an on-behalf upload re-filed into a different month invalidates both periods' client receipts", () => {
  const queryClient = fakeQueryClient();
  invalidateAfterUpload(queryClient as unknown as QueryClient, receipt({ period: "2026-09" }), "2026-08", "c1");

  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: queryKeys.clientReceipts("c1", "2026-08"),
  });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: queryKeys.clientReceipts("c1", "2026-09"),
  });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.clients("2026-08") });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.clients("2026-09") });
});

test("an own upload re-filed into a different month invalidates both periods' own receipts", () => {
  const queryClient = fakeQueryClient();
  invalidateAfterUpload(queryClient as unknown as QueryClient, receipt({ period: "2026-09" }), "2026-08");

  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.receipts("2026-08") });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.receipts("2026-09") });
});
