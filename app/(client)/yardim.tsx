import { HelpContent } from "@/src/features/help/HelpContent";
import { replayIntro } from "@/src/features/help/replayIntro";

/**
 * "Nasıl kullanılır" — reachable from Profil (`app/(client)/profil.tsx`) at
 * any time, not just on first launch. Registered with `href: null` in
 * `_layout.tsx` so it stays a real, linkable route without leaking into
 * the tab bar, the same defect the `kamera`/`firma-bilgileri`/`fis/[id]`
 * entries there already guard against.
 *
 * See `src/features/help/replayIntro.ts` for what the replay action
 * actually does and does not accomplish.
 */
export default function ClientYardimScreen() {
  return <HelpContent role="client" onReplayIntro={replayIntro} />;
}
