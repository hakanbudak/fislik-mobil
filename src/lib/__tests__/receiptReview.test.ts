import type { ReceiptOut } from "@/src/api/endpoints";
import {
  analysisState,
  ANALYSIS_LABELS,
  CATEGORY_LABELS,
  DOC_TYPE_LABELS,
  fmtDate,
  fmtNum,
  fmtTRY,
  mismatchedPeriod,
  parseAmountInput,
  PAYMENT_LABELS,
  slugifyTr,
  toReviewRow,
} from "../receiptReview";

function receipt(overrides: Partial<ReceiptOut> = {}): ReceiptOut {
  return {
    id: "r1",
    period: "2026-08",
    created_at: "2026-08-01T10:00:00Z",
    image_url: "https://example.com/r1.jpg",
    content_type: "image/jpeg",
    processed: false,
    open_issue: null,
    uploaded_by: null,
    ...overrides,
  };
}

test("deferred is not the same as pending", () => {
  expect(analysisState(receipt({ extraction: null }))).toBe("deferred");
  expect(analysisState(receipt({ extraction: undefined }))).toBe("none");
  expect(
    analysisState(
      receipt({
        extraction: {
          status: "pending",
          merchant_name: null,
          receipt_date: null,
          total_amount: null,
          vat_total: null,
          vat_breakdown: [],
          doc_type: null,
          merchant_tax_id: null,
          merchant_tax_id_type: null,
          merchant_tax_office: null,
          receipt_number: null,
          payment_method: null,
          expense_category: null,
          edited: false,
        },
      }),
    ),
  ).toBe("pending");
  expect(
    analysisState(
      receipt({
        extraction: {
          status: "failed",
          merchant_name: null,
          receipt_date: null,
          total_amount: null,
          vat_total: null,
          vat_breakdown: [],
          doc_type: null,
          merchant_tax_id: null,
          merchant_tax_id_type: null,
          merchant_tax_office: null,
          receipt_number: null,
          payment_method: null,
          expense_category: null,
          edited: false,
        },
      }),
    ),
  ).toBe("failed");
  expect(
    analysisState(
      receipt({
        extraction: {
          status: "done",
          merchant_name: "Migros",
          receipt_date: "2026-08-01",
          total_amount: "125.50",
          vat_total: "12.55",
          vat_breakdown: [],
          doc_type: "fis",
          merchant_tax_id: null,
          merchant_tax_id_type: null,
          merchant_tax_office: null,
          receipt_number: null,
          payment_method: null,
          expense_category: null,
          edited: false,
        },
      }),
    ),
  ).toBe("done");
});

test("flags a receipt filed under a different month than its own date", () => {
  expect(mismatchedPeriod("2026-07-28", "2026-08")).toBe("2026-07");
  expect(mismatchedPeriod("2026-08-03", "2026-08")).toBeNull();
  expect(mismatchedPeriod(null, "2026-08")).toBeNull();
});

test("parses both Turkish and machine amount formats", () => {
  expect(parseAmountInput("1.234,56")).toBe("1234.56");
  expect(parseAmountInput("1234.56")).toBe("1234.56");
  expect(parseAmountInput("1234")).toBe("1234");
  expect(parseAmountInput("")).toBeNull();
  expect(parseAmountInput("abc")).toBeUndefined();
});

test("formats an ISO date as GG.AA.YYYY", () => {
  expect(fmtDate("2026-08-12")).toBe("12.08.2026");
  expect(fmtDate(null)).toBeNull();
});

test("transliterates Turkish letters in slugs", () => {
  expect(slugifyTr("Şişli Güneş Ticaret")).toBe("sisli-gunes-ticaret");
});

test("fmtTRY renders a currency string and a dash for missing amounts", () => {
  expect(fmtTRY(1234.5)).toBe("₺1.234,50");
  expect(fmtTRY(null)).toBe("—");
  expect(fmtTRY(undefined)).toBe("—");
});

test("fmtNum renders a bare Turkish number and empty string for missing amounts", () => {
  expect(fmtNum(1234.5)).toBe("1.234,50");
  expect(fmtNum(-1234.56)).toBe("-1.234,56");
  expect(fmtNum(null)).toBe("");
  expect(fmtNum(undefined)).toBe("");
});

test("labels cover every documented key", () => {
  expect(DOC_TYPE_LABELS.fis).toBe("Fiş");
  expect(DOC_TYPE_LABELS.fatura).toBe("Fatura");
  expect(DOC_TYPE_LABELS.unknown).toBe("Bilinmiyor");
  expect(PAYMENT_LABELS.nakit).toBe("Nakit");
  expect(CATEGORY_LABELS.yemek).toBe("Yemek");
  expect(ANALYSIS_LABELS.deferred).toBe("Sıraya alındı");
  expect(ANALYSIS_LABELS.none).toBe("Analiz yok");
});

test("toReviewRow flattens a done receipt", () => {
  const r = receipt({
    processed: true,
    extraction: {
      status: "done",
      merchant_name: "Migros",
      receipt_date: "2026-08-01",
      total_amount: "125.50",
      vat_total: "12.55",
      vat_breakdown: [{ rate: 10, amount: "12.55" }],
      doc_type: "fis",
      merchant_tax_id: "1234567890",
      merchant_tax_id_type: "vkn",
      merchant_tax_office: "Kadıköy",
      receipt_number: "A-001",
      payment_method: "nakit",
      expense_category: "market",
      edited: true,
    },
  });
  const row = toReviewRow(r);
  expect(row.merchant).toBe("Migros");
  expect(row.date).toBe("2026-08-01");
  expect(row.docType).toBe("fis");
  expect(row.total).toBe(125.5);
  expect(row.vat).toBe(12.55);
  expect(row.st).toBe("done");
  expect(row.edited).toBe(true);
  expect(row.processed).toBe(true);
  expect(row.pdf).toBe(false);
});

test("toReviewRow tells deferred (null extraction) apart from none (undefined extraction)", () => {
  expect(toReviewRow(receipt({ extraction: null })).st).toBe("deferred");
  expect(toReviewRow(receipt({ extraction: undefined })).st).toBe("none");
});
