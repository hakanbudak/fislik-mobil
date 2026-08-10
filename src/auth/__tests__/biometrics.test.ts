import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requestUnlock, setBiometricEnabled } from "../biometrics";

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const auth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => jest.clearAllMocks());

test("unlocks without prompting when the feature is disabled", async () => {
  storage.getItem.mockResolvedValue(null);
  await expect(requestUnlock()).resolves.toBe(true);
  expect(auth.authenticateAsync).not.toHaveBeenCalled();
});

test("prompts and unlocks on success", async () => {
  storage.getItem.mockResolvedValue("1");
  auth.hasHardwareAsync.mockResolvedValue(true);
  auth.isEnrolledAsync.mockResolvedValue(true);
  auth.authenticateAsync.mockResolvedValue({ success: true } as never);
  await expect(requestUnlock()).resolves.toBe(true);
});

test("stays locked when the prompt is cancelled", async () => {
  storage.getItem.mockResolvedValue("1");
  auth.hasHardwareAsync.mockResolvedValue(true);
  auth.isEnrolledAsync.mockResolvedValue(true);
  auth.authenticateAsync.mockResolvedValue({ success: false } as never);
  await expect(requestUnlock()).resolves.toBe(false);
});

test("unlocks when the feature is on but the device has no enrolled biometrics", async () => {
  storage.getItem.mockResolvedValue("1");
  auth.hasHardwareAsync.mockResolvedValue(true);
  auth.isEnrolledAsync.mockResolvedValue(false);
  await expect(requestUnlock()).resolves.toBe(true);
});

test("setBiometricEnabled persists the preference", async () => {
  await setBiometricEnabled(true);
  expect(storage.setItem).toHaveBeenCalledWith("fislik.biometric_enabled", "1");
});
