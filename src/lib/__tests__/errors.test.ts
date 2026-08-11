import { ApiError, NetworkError } from "../../api/client";
import { apiErrorMessage } from "../errors";

test("returns the mapped Turkish copy for a known status, never the raw detail", () => {
  const message = apiErrorMessage(new ApiError(409, "receipt already submitted for this period"));
  expect(message).toBe("Bu işlem zaten yapılmış.");
  expect(message).not.toContain("already submitted");
});

test("falls back to the generic message for an unmapped status", () => {
  expect(apiErrorMessage(new ApiError(500, "internal error"))).toBe(
    "Bir şeyler ters gitti. Lütfen tekrar dene.",
  );
});

test("an override wins over the default status map", () => {
  expect(apiErrorMessage(new ApiError(401, "expired"), { 401: "E-posta veya şifre hatalı" })).toBe(
    "E-posta veya şifre hatalı",
  );
});

test("returns the network copy for a NetworkError", () => {
  expect(apiErrorMessage(new NetworkError())).toBe(
    "Bağlantı hatası. İnternetini kontrol edip tekrar dene.",
  );
});
