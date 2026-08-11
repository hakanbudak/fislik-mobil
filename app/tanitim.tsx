import { useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import { Archive, Camera, CheckSquare, CloudOff, Lock, Radar, Send, UserPlus } from "lucide-react-native";
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { useAuth } from "@/src/auth/AuthProvider";
import { LockedScreen } from "@/src/auth/LockedScreen";
import { markIntroSeen } from "@/src/onboarding/introSeen";
import { Button } from "@/src/theme/components/Button";
import { Spinner } from "@/src/theme/components/Spinner";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

const { width } = Dimensions.get("window");

interface Slide {
  key: string;
  Icon: typeof Camera;
  title: string;
  body: string;
}

/**
 * The client's four slides — copy, order and icons UNCHANGED from the
 * pre-login version of this tour. Slide four is the one that matters most:
 * it's the only place a user learns captures survive a dropped connection
 * instead of assuming they were lost.
 */
const CLIENT_SLIDES: Slide[] = [
  {
    key: "cek",
    Icon: Camera,
    title: "Fişinizi çekin",
    body: "Fişlerinizi art arda fotoğraflayarak biriktirirsiniz.",
  },
  {
    key: "gonder",
    Icon: Send,
    title: "Muhasebecinize gönderin",
    body: "Ay tamamlandığında hepsini tek seferde muhasebecinize iletirsiniz.",
  },
  {
    key: "takip",
    Icon: Radar,
    title: "Durumunu takip edin",
    body: "Fişleriniz işlendi mi, sorunlu mu — hepsi listede görünür.",
  },
  {
    key: "cevrimdisi",
    Icon: CloudOff,
    title: "İnternet olmasa da çalışır",
    body: "Çekimler telefonda bekler, bağlantı gelince kendiliğinden yüklenir.",
  },
];

/**
 * The accountant's four slides, added when this tour moved from a
 * pre-login/anon-only screen to a post-login, role-aware one. Each claim is
 * grounded in the same screens/API `src/features/help/HelpContent.tsx`'s
 * `ACCOUNTANT_STEPS` already verified, not invented for this tour:
 *  - invite: `mukellefleri-yonet.tsx` / `GrantsSection`'s accountant invite
 *    form (email -> invite -> access on acceptance).
 *  - mark processed: `app/(accountant)/mukellef/[clientId].tsx`'s
 *    `markProcessed`/`bulkMarkProcessed` (long-press one, or select many).
 *  - close the month: the same screen's `lockPeriod`/`unlockPeriod` — a
 *    locked month blocks the client's edits, and the accountant can reopen
 *    it any time.
 *  - export: the same screen's `downloadMonthZip` — the whole month's
 *    receipts as one ZIP, handed to the system share sheet.
 *
 * Deliberately NOT a fifth "works offline" slide, unlike the client's: the
 * offline queue (`src/upload/useUploadQueue.ts`) does also serve the
 * accountant when they capture on a taxpayer's behalf
 * (`app/(accountant)/mukellef/[clientId]/kamera.tsx`, Task 24's shoebox
 * flow), but that is an occasional, secondary action for this role, not
 * the daily habit it is for a client's own camera — the accountant's most
 * distinctive day-to-day loop is inviting/reviewing/closing/exporting, and
 * a five-slide tour where slide five is a corner case doesn't earn the
 * same weight the client's slide four does. See the report for this
 * decision spelled out in full.
 */
const ACCOUNTANT_SLIDES: Slide[] = [
  {
    key: "davet",
    Icon: UserPlus,
    title: "Mükellefinizi davet edin",
    body: "E-postayla davet edersiniz; kabul ettiğinde fişlerine erişirsiniz.",
  },
  {
    key: "isaretle",
    Icon: CheckSquare,
    title: "Fişleri işaretleyin",
    body: "Tek tek ya da hepsini birden işlenmiş olarak işaretlersiniz.",
  },
  {
    key: "kapat",
    Icon: Lock,
    title: "Ayı kapatın",
    body: "Kapalı ayda mükellef değişiklik yapamaz; dilediğiniz an yeniden açarsınız.",
  },
  {
    key: "aktar",
    Icon: Archive,
    title: "Arşivi dışa aktarın",
    body: "Ayın tüm fişlerini ZIP olarak indirip paylaşırsınız.",
  },
];

// `user.role` is a bare `string` at the type level (see `Role`'s docstring
// in `src/api/endpoints.ts`), not narrow enough to index a `Record<Role,
// Slide[]>` — a ternary against the one real alternative avoids a cast,
// matching how `app/index.tsx` picks a role shell.
function slidesForRole(role: string): Slide[] {
  return role === "accountant" ? ACCOUNTANT_SLIDES : CLIENT_SLIDES;
}

/**
 * `router.replace("/")` — the app's own entry route, not a hardcoded
 * `/giris` — because this tour is reachable both on first authed launch and
 * as a help-page replay. `app/index.tsx` already does exactly the dispatch
 * this exit needs (anon -> `/giris`, an authed client/accountant -> their
 * own tab group, locked -> the lock screen), and since `markIntroSeen()` is
 * attempted first, a normal launch's landing there re-reads the flag as
 * already "seen" and goes straight to the user's shell rather than bouncing
 * back into this screen.
 *
 * The `try`/`catch` here is this screen's half of the write-side fail-open
 * guarantee: `markIntroSeen()` flips an in-memory "seen for this session"
 * guard BEFORE it attempts the persisted write (see
 * `src/onboarding/introSeen.ts`), so even if the write itself rejects,
 * `hasSeenIntro()` still reports "seen" for the rest of this process.
 * Swallowing the error here and always calling `router.replace("/")`
 * afterwards means a storage failure can, at worst, cost this user the
 * tour again on their NEXT cold start — it can never bounce them straight
 * back into this screen in a loop within the current session, which is
 * what would happen if this function threw before navigating away.
 */
async function finish() {
  try {
    await markIntroSeen();
  } catch {
    // See the docstring above: the in-memory guard already prevents a
    // redirect loop, so this failure is safe to ignore.
  }
  router.replace("/");
}

/**
 * The four-slide post-login tour — role-aware, since an accountant and a
 * client use entirely different parts of the app. Lives at the app root
 * (`app/tanitim.tsx`), outside both the `(auth)` and role tab groups, so it
 * needs its own guard here: an anon visitor must not be able to view it,
 * hence the same status dispatch `app/index.tsx` uses before reading
 * `user.role`.
 *
 * One route, not one screen per role group — a duplicated screen and a
 * tab-leaking route are two defects this branch has already had to fix.
 */
export default function TanitimScreen() {
  const { status, user } = useAuth();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  if (status === "loading") return <Spinner />;
  if (status === "locked") return <LockedScreen />;
  if (status === "anon" || !user) return <Redirect href="/giris" />;

  const slides = slidesForRole(user.role);
  const isLast = index === slides.length - 1;

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  }

  return (
    <View style={styles.page}>
      <FlatList
        testID="tanitim-slides"
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.iconWrap}>
              <item.Icon color={tokens.color.primary} size={40} />
            </View>
            <Text style={[text.title, styles.title]}>{item.title}</Text>
            <Text style={[text.body, styles.body]}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {slides.map((slide, i) => (
          <View key={slide.key} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={[text.label, styles.skip]} onPress={finish}>
          Geç
        </Text>
        {isLast ? (
          <Button title="Başla" onPress={finish} />
        ) : (
          <Button
            title="İleri"
            onPress={() => listRef.current?.scrollToIndex({ index: index + 1 })}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.color.surface },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.space(7),
    gap: tokens.space(3),
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.card,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  title: { color: tokens.color.ink, textAlign: "center" },
  body: { color: tokens.color.inkSoft, textAlign: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: tokens.space(1.5) },
  dot: {
    width: 7,
    height: 7,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.border,
  },
  dotActive: { backgroundColor: tokens.color.primary },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.space(5),
    paddingVertical: tokens.space(5),
    gap: tokens.space(3),
  },
  skip: { color: tokens.color.inkSoft, padding: tokens.space(2) },
});
