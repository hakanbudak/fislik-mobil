import { greet } from "@/src/lib/greeting";

test("the '@/' path alias resolves to the repo root", () => {
  expect(greet()).toBe("Fişlik");
});
