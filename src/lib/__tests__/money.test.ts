import { formatMoney } from "../money";

test("formats decimal strings in Turkish notation, matching the web app", () => {
  expect(formatMoney("1234.5")).toBe("₺1.234,50");
  expect(formatMoney("0")).toBe("₺0,00");
  expect(formatMoney("400.00")).toBe("₺400,00");
  expect(formatMoney("1234567.89")).toBe("₺1.234.567,89");
});

test("renders a dash for missing amounts", () => {
  expect(formatMoney(null)).toBe("—");
});
