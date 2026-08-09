import { render, screen } from "@testing-library/react-native";
import type { ReceiptOut } from "@/src/api/endpoints";
import { ReceiptCard } from "../ReceiptCard";

const base: ReceiptOut = {
  id: "r1",
  period: "2026-08",
  created_at: "2026-08-01T10:00:00Z",
  image_url: "https://example.com/r1.jpg",
  content_type: "image/jpeg",
  processed: false,
  open_issue: null,
  uploaded_by: null,
};

const doneExtraction = {
  status: "done" as const,
  merchant_name: "Migros",
  receipt_date: "2026-08-01",
  total_amount: "125.50",
  vat_total: "12.55",
  vat_breakdown: [],
  doc_type: "fis" as const,
  merchant_tax_id: null,
  merchant_tax_id_type: null,
  merchant_tax_office: null,
  receipt_number: null,
  payment_method: null,
  expense_category: null,
  edited: false,
};

// The five states covered below mirror the web's ReceiptCard exactly
// (fislik-web/src/components/ReceiptCard.tsx), copy included — not the
// ANALYSIS_LABELS vocabulary, which belongs to the accountant review table.

test("shows the web's queued badge when extraction is deferred (null, not undefined)", () => {
  render(<ReceiptCard receipt={{ ...base, extraction: null }} onPress={jest.fn()} />);
  expect(screen.getByText("Sıraya alındı")).toBeOnTheScreen();
});

test("shows the web's pending badge while analysis is actively running", () => {
  render(<ReceiptCard receipt={{ ...base, extraction: { ...doneExtraction, status: "pending" } }} onPress={jest.fn()} />);
  expect(screen.getByText("Analiz ediliyor…")).toBeOnTheScreen();
});

test("shows the web's failed badge when analysis ran and failed", () => {
  render(<ReceiptCard receipt={{ ...base, extraction: { ...doneExtraction, status: "failed" } }} onPress={jest.fn()} />);
  expect(screen.getByText("Okunamadı")).toBeOnTheScreen();
});

test("renders no badge at all for a receipt that was never analyzed (extraction undefined) — deliberate, matches the web", () => {
  render(<ReceiptCard receipt={{ ...base, extraction: undefined }} onPress={jest.fn()} />);
  expect(screen.queryByText("Analiz yok")).toBeNull();
  expect(screen.queryByText("Okunamadı")).toBeNull();
  expect(screen.queryByText("Bekliyor")).toBeNull();
  expect(screen.queryByText("Sıraya alındı")).toBeNull();
});

test("shows no analysis badge for a successfully analyzed receipt with an amount", () => {
  render(<ReceiptCard receipt={{ ...base, extraction: doneExtraction }} onPress={jest.fn()} />);
  expect(screen.queryByText("Tamam")).toBeNull();
  expect(screen.queryByText("Okunamadı")).toBeNull();
});

test("flags a done extraction that couldn't read an amount as unreadable, same as failed", () => {
  render(
    <ReceiptCard receipt={{ ...base, extraction: { ...doneExtraction, total_amount: null } }} onPress={jest.fn()} />,
  );
  expect(screen.getByText("Okunamadı")).toBeOnTheScreen();
});

test("flags a receipt dated in a different month than the one it's filed under", () => {
  render(
    <ReceiptCard
      receipt={{ ...base, period: "2026-08", extraction: { ...doneExtraction, receipt_date: "2026-07-28" } }}
      onPress={jest.fn()}
    />,
  );
  expect(screen.getByText("Farklı ay")).toBeOnTheScreen();
});

test("does not flag a receipt dated within the month it's filed under", () => {
  render(
    <ReceiptCard
      receipt={{ ...base, period: "2026-08", extraction: { ...doneExtraction, receipt_date: "2026-08-01" } }}
      onPress={jest.fn()}
    />,
  );
  expect(screen.queryByText("Farklı ay")).toBeNull();
});

test("shows the KDV line for a done receipt with a known VAT total", () => {
  render(<ReceiptCard receipt={{ ...base, extraction: { ...doneExtraction, vat_total: "12.55" } }} onPress={jest.fn()} />);
  expect(screen.getByText("KDV ₺12,55")).toBeOnTheScreen();
});

test("shows no KDV line when vat_total is null, even though the total is known", () => {
  render(<ReceiptCard receipt={{ ...base, extraction: { ...doneExtraction, vat_total: null } }} onPress={jest.fn()} />);
  expect(screen.queryByText(/^KDV /)).toBeNull();
});
