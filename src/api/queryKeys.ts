export const queryKeys = {
  me: () => ["me"] as const,
  receipts: (period: string) => ["receipts", period] as const,
  summary: (period: string) => ["receipts", "summary", period] as const,
  grants: () => ["grants"] as const,
  company: () => ["company"] as const,
  notifications: () => ["notifications"] as const,
  clients: (period: string) => ["clients", period] as const,
  clientReceipts: (clientId: string, period: string) =>
    ["clients", clientId, "receipts", period] as const,
  clientCompany: (clientId: string) => ["clients", clientId, "company"] as const,
};
