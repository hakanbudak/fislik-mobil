import { render, screen } from "@testing-library/react-native";
import { Badge } from "../Badge";
import { tokens } from "../../tokens";

test("uses the success tone color", () => {
  render(<Badge label="İşlendi" tone="success" />);
  expect(screen.getByText("İşlendi")).toHaveStyle({ color: tokens.color.success });
});

// The default ("solid") surface is meant for a badge sitting on a solid
// card/panel background — e.g. the accountant's analysis-credit badge. It
// must stay exactly as it was: a translucent tone-tinted fill with
// tone-coloured text, not the opaque "onImage" treatment below.
test("solid surface (the default) keeps the translucent tint and tone-coloured text", () => {
  render(<Badge label="İşlendi" tone="success" />);
  expect(screen.getByText("İşlendi")).toHaveStyle({ color: tokens.color.success });
});

// "onImage" is for badges placed over a receipt photograph (ReceiptCard's
// stack). A translucent tint disappears over white paper, so this surface
// must render an opaque tone fill with light (`onPrimary`) text instead of
// tone-coloured text.
test("onImage surface uses an opaque tone fill with onPrimary text", () => {
  render(<Badge label="İşlendi" tone="success" surface="onImage" />);
  expect(screen.getByText("İşlendi")).toHaveStyle({ color: tokens.color.onPrimary });
});
