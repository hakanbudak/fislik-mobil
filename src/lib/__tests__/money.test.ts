import { formatMoney } from "../money";

test("formats decimal strings in Turkish notation", () => {
  expect(formatMoney("1234.5")).toBe("1.234,50 ₺");
  expect(formatMoney("0")).toBe("0,00 ₺");
});

test("renders a dash for missing amounts", () => {
  expect(formatMoney(null)).toBe("—");
});
