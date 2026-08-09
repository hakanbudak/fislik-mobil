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

test("shows a queued badge when extraction is deferred (null, not undefined)", () => {
  render(<ReceiptCard receipt={{ ...base, extraction: null }} onPress={jest.fn()} />);
  expect(screen.getByText("Sıraya alındı")).toBeOnTheScreen();
});

test("shows a pending badge while analysis is actively running", () => {
  render(<ReceiptCard receipt={{ ...base, extraction: { ...doneExtraction, status: "pending" } }} onPress={jest.fn()} />);
  expect(screen.getByText("Bekliyor")).toBeOnTheScreen();
});

test("shows a failed badge when analysis ran and failed", () => {
  render(<ReceiptCard receipt={{ ...base, extraction: { ...doneExtraction, status: "failed" } }} onPress={jest.fn()} />);
  expect(screen.getByText("Başarısız")).toBeOnTheScreen();
});

test("shows a distinct badge for a receipt that was never analyzed at all", () => {
  render(<ReceiptCard receipt={{ ...base, extraction: undefined }} onPress={jest.fn()} />);
  expect(screen.getByText("Analiz yok")).toBeOnTheScreen();
});

test("shows no analysis badge for a successfully analyzed receipt with an amount", () => {
  render(<ReceiptCard receipt={{ ...base, extraction: doneExtraction }} onPress={jest.fn()} />);
  expect(screen.queryByText("Tamam")).toBeNull();
  expect(screen.queryByText("Okunamadı")).toBeNull();
});

test("flags a done extraction that couldn't read an amount", () => {
  render(
    <ReceiptCard receipt={{ ...base, extraction: { ...doneExtraction, total_amount: null } }} onPress={jest.fn()} />,
  );
  expect(screen.getByText("Okunamadı")).toBeOnTheScreen();
});
