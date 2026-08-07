import * as SecureStore from "expo-secure-store";
import { clearSession, currentToken, loadSession, saveSession } from "../session";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const store = SecureStore as jest.Mocked<typeof SecureStore>;

beforeEach(async () => {
  jest.clearAllMocks();
  store.getItemAsync.mockResolvedValue(null);
  await loadSession();
});

test("loadSession returns null when nothing is stored", async () => {
  store.getItemAsync.mockResolvedValue(null);
  await expect(loadSession()).resolves.toBeNull();
  expect(currentToken()).toBeNull();
});

test("loadSession restores a stored token into memory", async () => {
  store.getItemAsync.mockResolvedValue("jwt-abc");
  await expect(loadSession()).resolves.toBe("jwt-abc");
  expect(currentToken()).toBe("jwt-abc");
});

test("saveSession persists and caches the token", async () => {
  await saveSession("jwt-new");
  expect(store.setItemAsync).toHaveBeenCalledWith("fislik.access_token", "jwt-new");
  expect(currentToken()).toBe("jwt-new");
});

test("clearSession wipes both storage and memory", async () => {
  await saveSession("jwt-new");
  await clearSession();
  expect(store.deleteItemAsync).toHaveBeenCalledWith("fislik.access_token");
  expect(currentToken()).toBeNull();
});
