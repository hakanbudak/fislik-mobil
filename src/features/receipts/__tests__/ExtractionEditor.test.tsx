import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ExtractionEditor } from "../ExtractionEditor";

const extraction = {
  status: "done" as const,
  merchant_name: "Migros",
  receipt_date: "2026-08-05",
  total_amount: "218.40",
  vat_total: "36.40",
  vat_breakdown: [{ rate: 20, amount: "36.40" }],
  doc_type: "fis" as const,
  edited: false,
  merchant_tax_id: "1234567890",
  merchant_tax_id_type: "vkn" as const,
  merchant_tax_office: "Şişli",
  receipt_number: "A-42",
  payment_method: "kredi_karti" as const,
  expense_category: "market" as const,
};

test("shows every extracted field", () => {
  render(<ExtractionEditor extraction={extraction} onSave={jest.fn()} onRetry={jest.fn()} />);
  expect(screen.getByDisplayValue("Migros")).toBeOnTheScreen();
  expect(screen.getByDisplayValue("1234567890")).toBeOnTheScreen();
  expect(screen.getByDisplayValue("A-42")).toBeOnTheScreen();
  expect(screen.getByText("Kredi Kartı")).toBeOnTheScreen();
  expect(screen.getByText("Market")).toBeOnTheScreen();
});

test("saves only the fields the user changed", async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(<ExtractionEditor extraction={extraction} onSave={onSave} onRetry={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText("Satıcı"), "Migros Jet");
  fireEvent.press(screen.getByText("Kaydet"));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ merchant_name: "Migros Jet" }));
});

test("normalises a Turkish-formatted amount before saving", async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(<ExtractionEditor extraction={extraction} onSave={onSave} onRetry={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText("Toplam"), "1.234,56");
  fireEvent.press(screen.getByText("Kaydet"));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ total_amount: "1234.56" }));
});

test("rejects an unparseable amount instead of sending it", async () => {
  const onSave = jest.fn();
  render(<ExtractionEditor extraction={extraction} onSave={onSave} onRetry={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText("Toplam"), "abc");
  fireEvent.press(screen.getByText("Kaydet"));
  expect(screen.getByText("Geçerli bir tutar girin")).toBeOnTheScreen();
  expect(onSave).not.toHaveBeenCalled();
});

test("reports a running analysis instead of an empty form", () => {
  render(
    <ExtractionEditor
      extraction={{ ...extraction, status: "pending" }}
      onSave={jest.fn()}
      onRetry={jest.fn()}
    />,
  );
  expect(screen.getByText("Fiş bilgileri çıkarılıyor…")).toBeOnTheScreen();
});

test("explains a deferred analysis rather than showing it as missing", () => {
  render(<ExtractionEditor extraction={null} onSave={jest.fn()} onRetry={jest.fn()} />);
  expect(
    screen.getByText("Bu ayın analiz hakkı doldu. Fiş sıraya alındı, gelecek ay analiz edilecek."),
  ).toBeOnTheScreen();
});

test("offers a retry when analysis failed", () => {
  const onRetry = jest.fn();
  render(
    <ExtractionEditor
      extraction={{ ...extraction, status: "failed" }}
      onSave={jest.fn()}
      onRetry={onRetry}
    />,
  );
  fireEvent.press(screen.getByText("Yeniden dene"));
  expect(onRetry).toHaveBeenCalled();
});

test("disables editing when the month is locked", () => {
  render(
    <ExtractionEditor extraction={extraction} onSave={jest.fn()} onRetry={jest.fn()} readOnly />,
  );
  expect(screen.queryByText("Kaydet")).toBeNull();
});
