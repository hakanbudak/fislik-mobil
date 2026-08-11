import { HelpContent } from "@/src/features/help/HelpContent";
import { replayIntro } from "@/src/features/help/replayIntro";

/**
 * "Nasıl kullanılır" for the accountant shell — see
 * `app/(client)/yardim.tsx` and `src/features/help/replayIntro.ts` for the
 * replay action's behaviour, shared by both roles.
 */
export default function AccountantYardimScreen() {
  return <HelpContent role="accountant" onReplayIntro={replayIntro} />;
}
