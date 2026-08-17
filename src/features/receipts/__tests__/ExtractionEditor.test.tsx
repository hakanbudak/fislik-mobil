import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
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
  render(<ExtractionEditor receiptId="r1" extraction={extraction} onSave={jest.fn()} onRetry={jest.fn()} />);
  expect(screen.getByDisplayValue("Migros")).toBeOnTheScreen();
  expect(screen.getByDisplayValue("1234567890")).toBeOnTheScreen();
  expect(screen.getByDisplayValue("A-42")).toBeOnTheScreen();
  expect(screen.getByText("Kredi Kartı")).toBeOnTheScreen();
  expect(screen.getByText("Market")).toBeOnTheScreen();
});

test("saves only the fields the user changed", async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(<ExtractionEditor receiptId="r1" extraction={extraction} onSave={onSave} onRetry={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText("Satıcı"), "Migros Jet");
  fireEvent.press(screen.getByText("Kaydet"));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ merchant_name: "Migros Jet" }));
});

test("normalises a Turkish-formatted amount before saving", async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(<ExtractionEditor receiptId="r1" extraction={extraction} onSave={onSave} onRetry={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText("Toplam"), "1.234,56");
  fireEvent.press(screen.getByText("Kaydet"));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ total_amount: "1234.56" }));
});

test("rejects an unparseable amount instead of sending it", async () => {
  const onSave = jest.fn();
  render(<ExtractionEditor receiptId="r1" extraction={extraction} onSave={onSave} onRetry={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText("Toplam"), "abc");
  fireEvent.press(screen.getByText("Kaydet"));
  expect(screen.getByText("Geçerli bir tutar girin")).toBeOnTheScreen();
  expect(onSave).not.toHaveBeenCalled();
});

test("reports a running analysis instead of an empty form", () => {
  render(
    <ExtractionEditor
      receiptId="r1"
      extraction={{ ...extraction, status: "pending" }}
      onSave={jest.fn()}
      onRetry={jest.fn()}
    />,
  );
  expect(screen.getByText("Fiş bilgileri çıkarılıyor…")).toBeOnTheScreen();
});

test("explains a deferred analysis rather than showing it as missing", () => {
  render(<ExtractionEditor receiptId="r1" extraction={null} onSave={jest.fn()} onRetry={jest.fn()} />);
  expect(
    screen.getByText("Bu ayın analiz hakkı doldu. Fiş sıraya alındı, gelecek ay analiz edilecek."),
  ).toBeOnTheScreen();
});

test("offers a retry when analysis failed", () => {
  const onRetry = jest.fn();
  render(
    <ExtractionEditor
      receiptId="r1"
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
    <ExtractionEditor receiptId="r1" extraction={extraction} onSave={jest.fn()} onRetry={jest.fn()} readOnly />,
  );
  expect(screen.queryByText("Kaydet")).toBeNull();
});

// Regression: any PATCH — even an empty one — makes the API permanently
// stamp the receipt hand-edited and blocks retrying a failed/pending
// extraction forever, so a no-op Kaydet press must never reach onSave.
test("disables Kaydet and skips onSave when nothing changed", () => {
  const onSave = jest.fn();
  render(<ExtractionEditor receiptId="r1" extraction={extraction} onSave={onSave} onRetry={jest.fn()} />);
  expect(screen.getByLabelText("Kaydet")).toBeDisabled();
  fireEvent.press(screen.getByLabelText("Kaydet"));
  expect(onSave).not.toHaveBeenCalled();
});

// The test above can pass purely because a disabled Pressable swallows
// fireEvent.press — it never actually proves handleSave's own emptiness
// check runs. `UNSAFE_getByProps` reaches the Pressable's `onPress` prop
// directly (bypassing RN's disabled-touch gating entirely, unlike
// fireEvent.press), so this calls handleSave exactly as if the button were
// enabled — independent of `disabled={!hasChanges}`. If someone later makes
// Kaydet always-enabled (a plausible "let validation errors surface"
// change), this is what still stands between a reflex tap and a receipt
// that can never be re-analyzed.
test("handleSave's own guard refuses an empty patch, independent of the button's disabled state", () => {
  const onSave = jest.fn();
  render(<ExtractionEditor receiptId="r1" extraction={extraction} onSave={onSave} onRetry={jest.fn()} />);
  const button = screen.UNSAFE_getByProps({ accessibilityLabel: "Kaydet" });
  button.props.onPress();
  expect(onSave).not.toHaveBeenCalled();
});

// Regression: merchant_tax_id_type must compare normalized-vs-normalized,
// like every other selector, or a receipt where the AI found a tax id but
// left the type null reports a spurious diff on an untouched field.
test("does not report a tax-id-type diff when the type was never edited", async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const withNullType = { ...extraction, merchant_tax_id: "1234567890", merchant_tax_id_type: null };
  render(<ExtractionEditor receiptId="r1" extraction={withNullType} onSave={onSave} onRetry={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText("Satıcı"), "Migros Jet");
  fireEvent.press(screen.getByText("Kaydet"));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ merchant_name: "Migros Jet" }));
});

// Regression: buildDraft formats amounts to two decimals and computeChanges
// re-parses them; an untouched field must never round-trip into a spurious
// diff regardless of how many decimals the API originally sent.
test.each(["218.4", "218.40"])(
  "does not report a spurious amount diff when total_amount is untouched ('%s')",
  async (totalAmount) => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const withAmount = { ...extraction, total_amount: totalAmount };
    render(<ExtractionEditor receiptId="r1" extraction={withAmount} onSave={onSave} onRetry={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText("Satıcı"), "Migros Jet");
    fireEvent.press(screen.getByText("Kaydet"));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ merchant_name: "Migros Jet" }));
  },
);

test("rejects a malformed date instead of sending it", () => {
  const onSave = jest.fn();
  render(<ExtractionEditor receiptId="r1" extraction={extraction} onSave={onSave} onRetry={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText("Tarih"), "05.08.2026");
  fireEvent.press(screen.getByText("Kaydet"));
  expect(screen.getByText("Geçerli bir tarih girin (YYYY-AA-GG)")).toBeOnTheScreen();
  expect(onSave).not.toHaveBeenCalled();
});

test("rejects a calendar-invalid date instead of sending it", () => {
  const onSave = jest.fn();
  render(<ExtractionEditor receiptId="r1" extraction={extraction} onSave={onSave} onRetry={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText("Tarih"), "2026-02-31");
  fireEvent.press(screen.getByText("Kaydet"));
  expect(screen.getByText("Geçerli bir tarih girin (YYYY-AA-GG)")).toBeOnTheScreen();
  expect(onSave).not.toHaveBeenCalled();
});

test("rejects a VKN that isn't 10 digits", () => {
  const onSave = jest.fn();
  render(<ExtractionEditor receiptId="r1" extraction={extraction} onSave={onSave} onRetry={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText("VKN/TCKN"), "12345");
  fireEvent.press(screen.getByText("Kaydet"));
  expect(screen.getByText("VKN 10 haneli olmalı")).toBeOnTheScreen();
  expect(onSave).not.toHaveBeenCalled();
});

test("rejects a TCKN that isn't 11 digits", () => {
  const onSave = jest.fn();
  const tcknExtraction = { ...extraction, merchant_tax_id_type: "tckn" as const };
  render(<ExtractionEditor receiptId="r1" extraction={tcknExtraction} onSave={onSave} onRetry={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText("VKN/TCKN"), "123456789");
  fireEvent.press(screen.getByText("Kaydet"));
  expect(screen.getByText("TCKN 11 haneli olmalı")).toBeOnTheScreen();
  expect(onSave).not.toHaveBeenCalled();
});

// `draft` is seeded once at mount, so a SAME mounted editor handed a
// different receipt is the shape of a data-loss bug: the form keeps the old
// receipt's values while `onSave` patches the new receipt, and the API's
// PATCH is unrecoverable. The routing fix (a `Stack` per detail route) means
// nothing reaches this component stale in the app today, but that protection
// lives at the call sites; these two pin the guard here, where a future
// `router.navigate`/`replace`/notification-tap route into the same screen
// cannot get past it.
const otherExtraction = {
  ...extraction,
  merchant_name: "Şok Market",
  total_amount: "42.00",
  vat_total: "7.00",
  vat_breakdown: [{ rate: 20, amount: "7.00" }],
  merchant_tax_id: "9876543210",
  receipt_number: "B-7",
};

test("re-seeds every field when it is handed a different receipt without re-mounting", () => {
  const { rerender } = render(
    <ExtractionEditor receiptId="r1" extraction={extraction} onSave={jest.fn()} onRetry={jest.fn()} />,
  );
  expect(screen.getByLabelText("Satıcı").props.value).toBe("Migros");

  rerender(
    <ExtractionEditor receiptId="r2" extraction={otherExtraction} onSave={jest.fn()} onRetry={jest.fn()} />,
  );
  expect(screen.getByLabelText("Satıcı").props.value).toBe("Şok Market");
  expect(screen.getByLabelText("Toplam").props.value).toBe("42,00");
  expect(screen.getByLabelText("VKN/TCKN").props.value).toBe("9876543210");
  expect(screen.getByLabelText("Fiş no").props.value).toBe("B-7");
});

test("does not carry an unsaved edit onto the next receipt's patch", async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const { rerender } = render(
    <ExtractionEditor receiptId="r1" extraction={extraction} onSave={onSave} onRetry={jest.fn()} />,
  );
  fireEvent.changeText(screen.getByLabelText("Satıcı"), "Migros Jet");

  rerender(
    <ExtractionEditor receiptId="r2" extraction={otherExtraction} onSave={onSave} onRetry={jest.fn()} />,
  );
  // Nothing has changed relative to r2's own extraction, so there is nothing
  // to save. Without the re-seed the draft still holds r1's values, Kaydet
  // goes live, and pressing it writes r1's merchant, amount, tax id and
  // receipt number onto r2. `UNSAFE_getByProps` reaches `onPress` directly
  // (see the note above `handleSave`'s own guard) so this proves the patch
  // is genuinely empty, not merely that a disabled Pressable swallowed the
  // press.
  expect(screen.getByLabelText("Kaydet")).toBeDisabled();
  await act(async () => {
    screen.UNSAFE_getByProps({ accessibilityLabel: "Kaydet" }).props.onPress();
  });
  expect(onSave).not.toHaveBeenCalled();
});
