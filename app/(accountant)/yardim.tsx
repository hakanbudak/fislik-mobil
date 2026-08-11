import { router } from "expo-router";
import { HelpContent } from "@/src/features/help/HelpContent";
import { resetIntro } from "@/src/onboarding/introSeen";

/**
 * "Nasıl kullanılır" for the accountant shell — see
 * `app/(client)/yardim.tsx` for why the replay handler wraps `resetIntro()`
 * in try/finally rather than pushing that handling into the shared helper.
 */
export default function AccountantYardimScreen() {
  return (
    <HelpContent
      role="accountant"
      onReplayIntro={async () => {
        try {
          await resetIntro();
        } catch {
          // A failed reset must not block navigation to the tour — see
          // `app/(client)/yardim.tsx`.
        } finally {
          router.replace("/(auth)/tanitim");
        }
      }}
    />
  );
}
