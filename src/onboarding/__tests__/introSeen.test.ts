import AsyncStorage from "@react-native-async-storage/async-storage";
import { hasSeenIntro, markIntroSeen, resetIntro } from "../introSeen";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}));
const store = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(async () => {
  jest.clearAllMocks();
  // `sessionSeen` is module-scoped, not reset between tests by
  // `jest.clearAllMocks()` — put every test back to a clean "not seen"
  // baseline explicitly rather than relying on file-level test order.
  store.removeItem.mockResolvedValue(undefined);
  await resetIntro();
  jest.clearAllMocks();
});

test("a fresh install has not seen the intro", async () => {
  store.getItem.mockResolvedValue(null);
  await expect(hasSeenIntro()).resolves.toBe(false);
});

test("marking it seen persists under the documented (post-login) key", async () => {
  store.setItem.mockResolvedValue(undefined);
  await markIntroSeen();
  expect(store.setItem).toHaveBeenCalledWith("fislik.post_login_intro_seen", "1");
});

test("resetting lets the tour play again", async () => {
  store.removeItem.mockResolvedValue(undefined);
  await resetIntro();
  expect(store.removeItem).toHaveBeenCalledWith("fislik.post_login_intro_seen");
});

test("a failed write still marks the session seen, so the entry route can't loop back into the tour", async () => {
  store.setItem.mockRejectedValue(new Error("storage unavailable"));
  await expect(markIntroSeen()).rejects.toThrow("storage unavailable");
  store.getItem.mockResolvedValue(null); // the persisted flag genuinely never got written
  await expect(hasSeenIntro()).resolves.toBe(true); // but the in-memory guard still reports "seen"
});

test("resetIntro clears the in-memory guard too, so a replay actually shows the tour again", async () => {
  store.setItem.mockResolvedValue(undefined);
  await markIntroSeen();
  store.removeItem.mockResolvedValue(undefined);
  await resetIntro();
  store.getItem.mockResolvedValue(null);
  await expect(hasSeenIntro()).resolves.toBe(false);
});
