export const queryKeys = {
  me: () => ["me"] as const,
  receipts: (period: string) => ["receipts", period] as const,
  summary: (period: string) => ["receipts", "summary", period] as const,
  grants: () => ["grants"] as const,
  company: () => ["company"] as const,
  notifications: () => ["notifications"] as const,
  // Shared prefix for "all clients, any period" invalidation (e.g. after a
  // grant accept/revoke changes which clients an accountant can see) — keep
  // `clients(period)` deriving from this rather than repeating the literal
  // at call sites, so the two can't drift apart.
  clientsAll: () => ["clients"] as const,
  clients: (period: string) => [...queryKeys.clientsAll(), period] as const,
  clientReceipts: (clientId: string, period: string) =>
    ["clients", clientId, "receipts", period] as const,
  clientCompany: (clientId: string) => ["clients", clientId, "company"] as const,
  submission: (period: string) => ["submission", period] as const,
  periodLock: (period: string, clientId?: string) => ["periodLock", period, clientId ?? null] as const,
  credits: () => ["credits"] as const,
};
