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

test("saveSession rejects when SecureStore.setItemAsync rejects, and memory is unchanged", async () => {
  await saveSession("jwt-original");
  const error = new Error("Storage failed");
  store.setItemAsync.mockRejectedValueOnce(error);
  await expect(saveSession("jwt-new")).rejects.toThrow("Storage failed");
  expect(currentToken()).toBe("jwt-original");
});

test("clearSession rejects when SecureStore.deleteItemAsync rejects, and memory is unchanged", async () => {
  await saveSession("jwt-existing");
  const error = new Error("Storage failed");
  store.deleteItemAsync.mockRejectedValueOnce(error);
  await expect(clearSession()).rejects.toThrow("Storage failed");
  expect(currentToken()).toBe("jwt-existing");
});
