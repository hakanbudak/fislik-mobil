import { isPdf } from "../receipts";

test("treats a missing content type as an image", () => {
  expect(isPdf({})).toBe(false);
  expect(isPdf({ content_type: "image/jpeg" })).toBe(false);
  expect(isPdf({ content_type: "application/pdf" })).toBe(true);
});
