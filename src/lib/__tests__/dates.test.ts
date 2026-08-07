import { formatDateTime } from "../dates";

// Period is defined as local-calendar, never UTC (see src/lib/period.ts), and
// formatDateTime follows the same convention. Pin the process timezone to
// Turkey's so this test's local-time rendering of a fixed UTC instant is
// deterministic in CI regardless of the runner's default TZ.
process.env.TZ = "Europe/Istanbul";

test("formats an ISO timestamp as a Turkish date and time", () => {
  // 2026-08-07T11:30:00.000Z is 2026-08-07T14:30:00 in Europe/Istanbul (UTC+3, no DST).
  expect(formatDateTime("2026-08-07T11:30:00.000Z")).toBe("7 Ağu 2026, 14:30");
});
