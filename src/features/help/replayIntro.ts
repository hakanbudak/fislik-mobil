import { router } from "expo-router";
import { resetIntro } from "@/src/onboarding/introSeen";

/**
 * The help page's "replay the intro" action, shared by both `yardim.tsx`
 * route screens (identical for both roles, so it lives here rather than
 * being duplicated in each).
 *
 * `resetIntro()` deliberately doesn't swallow AsyncStorage errors — see its
 * docstring — so this call site swallows them itself: a failed
 * `removeItem` must not strand the user on this screen, and navigation to
 * the tour must still happen either way.
 *
 * Honestly, though, `resetIntro()`'s effect on THIS path is close to
 * inert, success or failure: the "seen" flag it clears is only ever read
 * for an authed session (`app/index.tsx`, `status === "authed"`), and the
 * tour's own exit (`app/tanitim.tsx`'s `finish()`) re-sets the flag via
 * `markIntroSeen()` before leaving. The caller here is always authed, so
 * the flag this clears is not what puts the tour on screen — navigating to
 * `/tanitim` directly is. Kept anyway because the brief asks for it and it
 * is not actively wrong: the one case it changes anything is a user who
 * abandons the replayed tour mid-way, later signs out, and cold-starts —
 * they would see the tour again on that next launch.
 */
export async function replayIntro(): Promise<void> {
  try {
    await resetIntro();
  } catch {
    // See the docstring above — a failed reset must not block navigation
    // to the tour.
  } finally {
    router.replace("/tanitim");
  }
}
