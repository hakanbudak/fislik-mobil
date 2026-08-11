import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "fislik.intro_seen";

export async function hasSeenIntro(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === "1";
}

export async function markIntroSeen(): Promise<void> {
  await AsyncStorage.setItem(KEY, "1");
}

/** Lets the help page replay the tour. */
export async function resetIntro(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
