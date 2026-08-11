import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Renamed from the pre-login tour's `fislik.intro_seen` on purpose: the
 * tour it now gates is a different screen with different, role-aware copy
 * shown at a different point in the flow (after login, not before). Anyone
 * carrying the old flag — including whoever is testing this change — must
 * see the new tour once, not have it silently skipped because a
 * differently-scoped flag happens to share a truthy value.
 *
 * The old `fislik.intro_seen` value is left orphaned in AsyncStorage on
 * every device that had it — deliberately abandoned, not migrated. Nothing
 * reads that key anymore, and nothing ever will again; there's no bug to
 * find here if you go looking for where it gets cleaned up.
 */
const KEY = "fislik.post_login_intro_seen";

/**
 * Module-scoped, not persisted, and never cleared by a failed write: set
 * the instant `markIntroSeen()` is called, before the AsyncStorage write is
 * even attempted. This is what makes the `finish()` -> `/` -> tour redirect
 * loop (see `app/tanitim.tsx` and `app/index.tsx`) structurally impossible
 * within a session rather than merely unlikely — if the persisted write
 * fails, `hasSeenIntro()` still reports "seen" for the rest of this
 * process, so the entry route can't bounce the user straight back into the
 * tour. Only a fresh cold start, which re-reads storage from scratch, can
 * show the tour again in that failure case — the same fail-open trade this
 * codebase already accepts for the read side (see `app/index.tsx`'s
 * docstring).
 */
let sessionSeen = false;

export async function hasSeenIntro(): Promise<boolean> {
  if (sessionSeen) return true;
  return (await AsyncStorage.getItem(KEY)) === "1";
}

export async function markIntroSeen(): Promise<void> {
  sessionSeen = true;
  await AsyncStorage.setItem(KEY, "1");
}

/** Lets the help page replay the tour. */
export async function resetIntro(): Promise<void> {
  sessionSeen = false;
  await AsyncStorage.removeItem(KEY);
}
