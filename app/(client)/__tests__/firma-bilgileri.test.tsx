import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import FirmaBilgileriScreen from "../firma-bilgileri";
import * as endpoints from "@/src/api/endpoints";
import type { CompanyOut } from "@/src/api/endpoints";
import { ApiError } from "@/src/api/client";
import { createTestQueryClient } from "@/src/test/queryClient";

jest.mock("@/src/api/endpoints");

let mockSearchParams: { onboarding?: string } = {};
jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => mockSearchParams,
}));

const mocked = endpoints as jest.Mocked<typeof endpoints>;
const mockedRouter = router as unknown as { replace: jest.Mock };

function renderScreen() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <FirmaBilgileriScreen />
    </QueryClientProvider>,
  );
}

const existingCompany: CompanyOut = {
  full_name: "Ayşe Yıldırım",
  trade_name: "Yıldırım Ticaret Ltd. Şti.",
  tax_office: "Kadıköy",
  tax_number: "1234567890",
  national_id: "12345678901",
  business_address: "Bahariye Cad. No:1 Kadıköy/İstanbul",
  tax_type: "Gelir Vergisi",
  activity_code: "47.11.01",
  activity_name: "Perakende gıda satışı",
  started_on: "2020-01-15",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = {};
});

test("renders existing values seeded from the loaded profile", async () => {
  mocked.getCompany.mockResolvedValue(existingCompany);
  renderScreen();

  await waitFor(() => expect(screen.getByDisplayValue("Ayşe Yıldırım")).toBeOnTheScreen());
  expect(screen.getByDisplayValue("Yıldırım Ticaret Ltd. Şti.")).toBeOnTheScreen();
  expect(screen.getByDisplayValue("Kadıköy")).toBeOnTheScreen();
  expect(screen.getByDisplayValue("1234567890")).toBeOnTheScreen();
  expect(screen.getByDisplayValue("12345678901")).toBeOnTheScreen();
  expect(screen.getByDisplayValue("Bahariye Cad. No:1 Kadıköy/İstanbul")).toBeOnTheScreen();
  expect(screen.getByDisplayValue("Gelir Vergisi")).toBeOnTheScreen();
  expect(screen.getByDisplayValue("47.11.01")).toBeOnTheScreen();
  expect(screen.getByDisplayValue("Perakende gıda satışı")).toBeOnTheScreen();
  expect(screen.getByDisplayValue("2020-01-15")).toBeOnTheScreen();
});

test("treats a 404 from the company endpoint as an empty profile, not an error", async () => {
  mocked.getCompany.mockRejectedValue(new ApiError(404, "not found"));
  renderScreen();

  await waitFor(() => expect(screen.getByLabelText("Adı Soyadı")).toBeOnTheScreen());
  expect(screen.getByLabelText("Adı Soyadı").props.value).toBe("");
});

test("rejects a 9-digit tax number without calling the API", async () => {
  mocked.getCompany.mockRejectedValue(new ApiError(404, "not found"));
  renderScreen();

  await waitFor(() => expect(screen.getByLabelText("Adı Soyadı")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Adı Soyadı"), "Ayşe Yıldırım");
  fireEvent.changeText(screen.getByLabelText("Vergi Dairesi"), "Kadıköy");
  fireEvent.changeText(screen.getByLabelText("İş Yeri Adresi"), "Bahariye Cad. No:1");
  fireEvent.changeText(screen.getByLabelText("Vergi Kimlik No (10 hane)"), "123456789");

  fireEvent.press(screen.getByText("Kaydet"));

  await waitFor(() =>
    expect(screen.getByText("Vergi kimlik no 10 haneli olmalı")).toBeOnTheScreen(),
  );
  expect(mocked.saveCompany).not.toHaveBeenCalled();
});

test("accepts a blank optional TC Kimlik No field", async () => {
  mocked.getCompany.mockRejectedValue(new ApiError(404, "not found"));
  mocked.saveCompany.mockResolvedValue(existingCompany);
  renderScreen();

  await waitFor(() => expect(screen.getByLabelText("Adı Soyadı")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Adı Soyadı"), "Ayşe Yıldırım");
  fireEvent.changeText(screen.getByLabelText("Vergi Dairesi"), "Kadıköy");
  fireEvent.changeText(screen.getByLabelText("İş Yeri Adresi"), "Bahariye Cad. No:1");
  fireEvent.changeText(screen.getByLabelText("Vergi Kimlik No (10 hane)"), "1234567890");

  fireEvent.press(screen.getByText("Kaydet"));

  await waitFor(() => expect(mocked.saveCompany).toHaveBeenCalled());
  expect(screen.queryByText("TC kimlik no 11 haneli olmalı")).toBeNull();
});

test("rejects a 10-digit TC Kimlik No when provided", async () => {
  mocked.getCompany.mockRejectedValue(new ApiError(404, "not found"));
  renderScreen();

  await waitFor(() => expect(screen.getByLabelText("Adı Soyadı")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Adı Soyadı"), "Ayşe Yıldırım");
  fireEvent.changeText(screen.getByLabelText("Vergi Dairesi"), "Kadıköy");
  fireEvent.changeText(screen.getByLabelText("İş Yeri Adresi"), "Bahariye Cad. No:1");
  fireEvent.changeText(screen.getByLabelText("Vergi Kimlik No (10 hane)"), "1234567890");
  fireEvent.changeText(screen.getByLabelText("TC Kimlik No (11 hane)"), "1234567890");

  fireEvent.press(screen.getByText("Kaydet"));

  await waitFor(() => expect(screen.getByText("TC kimlik no 11 haneli olmalı")).toBeOnTheScreen());
  expect(mocked.saveCompany).not.toHaveBeenCalled();
});

test("a valid form calls saveCompany with the trimmed payload and invalidates the company query", async () => {
  mocked.getCompany.mockResolvedValueOnce(existingCompany).mockResolvedValue(existingCompany);
  mocked.saveCompany.mockResolvedValue(existingCompany);
  renderScreen();

  await waitFor(() => expect(screen.getByDisplayValue("Ayşe Yıldırım")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Kaydet"));

  await waitFor(() =>
    expect(mocked.saveCompany).toHaveBeenCalledWith({
      full_name: "Ayşe Yıldırım",
      trade_name: "Yıldırım Ticaret Ltd. Şti.",
      tax_office: "Kadıköy",
      tax_number: "1234567890",
      national_id: "12345678901",
      business_address: "Bahariye Cad. No:1 Kadıköy/İstanbul",
      tax_type: "Gelir Vergisi",
      activity_code: "47.11.01",
      activity_name: "Perakende gıda satışı",
      started_on: "2020-01-15",
    }),
  );
  await waitFor(() => expect(mocked.getCompany).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByText("Firma bilgileri kaydedildi")).toBeOnTheScreen());
});

test("only accepts digits in the Vergi Kimlik No field, up to 10 characters", async () => {
  mocked.getCompany.mockRejectedValue(new ApiError(404, "not found"));
  renderScreen();

  await waitFor(() => expect(screen.getByLabelText("Adı Soyadı")).toBeOnTheScreen());
  fireEvent.changeText(screen.getByLabelText("Vergi Kimlik No (10 hane)"), "12a3-45678901");
  expect(screen.getByLabelText("Vergi Kimlik No (10 hane)").props.value).toBe("1234567890");
});

test("shows a curated error message, never the raw detail, when saving fails", async () => {
  mocked.getCompany.mockResolvedValue(existingCompany);
  mocked.saveCompany.mockRejectedValue(new ApiError(500, "internal trace xyz"));
  renderScreen();

  await waitFor(() => expect(screen.getByDisplayValue("Ayşe Yıldırım")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Kaydet"));

  await waitFor(() =>
    expect(screen.getByText("Bir şeyler ters gitti. Lütfen tekrar dene.")).toBeOnTheScreen(),
  );
  expect(screen.queryByText("internal trace xyz")).toBeNull();
});

test("does not show the onboarding skip button when arriving from the profile screen", async () => {
  mockSearchParams = {};
  mocked.getCompany.mockRejectedValue(new ApiError(404, "not found"));
  renderScreen();

  await waitFor(() => expect(screen.getByLabelText("Adı Soyadı")).toBeOnTheScreen());
  expect(screen.queryByText("Şimdilik geç")).toBeNull();
});

test("shows the onboarding skip button when arriving right after registration", async () => {
  mockSearchParams = { onboarding: "1" };
  mocked.getCompany.mockRejectedValue(new ApiError(404, "not found"));
  renderScreen();

  await waitFor(() => expect(screen.getByText("Şimdilik geç")).toBeOnTheScreen());
});

test("pressing the skip button leaves for the client home without saving", async () => {
  mockSearchParams = { onboarding: "1" };
  mocked.getCompany.mockRejectedValue(new ApiError(404, "not found"));
  renderScreen();

  await waitFor(() => expect(screen.getByText("Şimdilik geç")).toBeOnTheScreen());
  fireEvent.press(screen.getByText("Şimdilik geç"));

  expect(mockedRouter.replace).toHaveBeenCalledWith("/(client)");
  expect(mocked.saveCompany).not.toHaveBeenCalled();
});
