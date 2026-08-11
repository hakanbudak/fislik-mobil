import AsyncStorage from "@react-native-async-storage/async-storage";
import { hasSeenIntro, markIntroSeen, resetIntro } from "../introSeen";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}));
const store = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => jest.clearAllMocks());

test("a fresh install has not seen the intro", async () => {
  store.getItem.mockResolvedValue(null);
  await expect(hasSeenIntro()).resolves.toBe(false);
});

test("marking it seen persists under the documented key", async () => {
  await markIntroSeen();
  expect(store.setItem).toHaveBeenCalledWith("fislik.intro_seen", "1");
});

test("resetting lets the tour play again", async () => {
  await resetIntro();
  expect(store.removeItem).toHaveBeenCalledWith("fislik.intro_seen");
});
