import { useEffect, useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import { Archive, Camera, CheckSquare, CloudOff, Lock, Radar, Send, UserPlus } from "lucide-react-native";
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { useAuth } from "@/src/auth/AuthProvider";
import { LockedScreen } from "@/src/auth/LockedScreen";
import { markIntroSeen } from "@/src/onboarding/introSeen";
import { Button } from "@/src/theme/components/Button";
import { FislikMark } from "@/src/theme/components/FislikMark";
import { Spinner } from "@/src/theme/components/Spinner";
import { font, text } from "@/src/theme/typography";
import { tokens } from "@/src/theme/tokens";

const { width: windowWidth } = Dimensions.get("window");

// Card pager geometry — see the design handoff ("Screen 2: Intro tour").
// Cards are 300pt wide with a 16pt gap, so the FlatList snaps every 316pt;
// the index must be derived from that interval, never from window width,
// or the dots/İleri button desync from the card that's actually centered.
const CARD_WIDTH = 300;
const CARD_GAP = 16;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;
// (windowWidth - CARD_WIDTH) / 2 is the handoff's own formula (45 on a
// 390pt viewport). Below ~332pt wide that goes small; clamped to a 12pt
// floor so the first card never starts far enough right to run off a
// narrow viewport — see the report for the exact numbers this protects.
const CARD_INSET = Math.max(12, (windowWidth - CARD_WIDTH) / 2);
const ZIGZAG_TOOTH = 12;
const ZIGZAG_HEIGHT = 8;
const DOT_SIZE = 7;
const DOT_ACTIVE_WIDTH = 22;
// (44 - DOT_SIZE) / 2, rounded up — same "grow a small hit target to the
// 44pt minimum via hitSlop" pattern as MonthPicker's chevrons.
const DOT_HIT_SLOP = 19;

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
 *    `markProcessed`/`bulkMarkProcessed` — long-press marks one receipt;
 *    the bulk control ("Tümünü işlendi yap") is all-or-nothing for the
 *    period, not a multi-select, which is why the slide's own copy says
 *    "tek tek ya da hepsini birden" rather than implying a picker.
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

// Repeating "l6 -8 l6 8" (or its mirror) tooth path from the handoff, built
// once per direction rather than hand-written — CARD_WIDTH / ZIGZAG_TOOTH
// is exactly 25, so the pattern tiles with no partial tooth at either edge.
function zigzagPath(direction: "up" | "down"): string {
  const half = ZIGZAG_TOOTH / 2;
  const count = CARD_WIDTH / ZIGZAG_TOOTH;
  const start = direction === "up" ? `M0 ${ZIGZAG_HEIGHT}` : "M0 0";
  const step = direction === "up" ? ` l${half} -${ZIGZAG_HEIGHT} l${half} ${ZIGZAG_HEIGHT}` : ` l${half} ${ZIGZAG_HEIGHT} l${half} -${ZIGZAG_HEIGHT}`;
  return start + step.repeat(count) + " Z";
}

const ZIGZAG_UP_PATH = zigzagPath("up");
const ZIGZAG_DOWN_PATH = zigzagPath("down");

/**
 * The card's torn-paper top/bottom edge. Both start and end flush with the
 * flat baseline (`ZIGZAG_HEIGHT`/`0`), so simply closing the path (`Z`)
 * connects back along that baseline instead of needing an explicit
 * trailing edge — no separate "fill down to baseline" segment required.
 */
function ZigzagEdge({ direction }: { direction: "up" | "down" }) {
  return (
    <Svg width={CARD_WIDTH} height={ZIGZAG_HEIGHT}>
      <Path d={direction === "up" ? ZIGZAG_UP_PATH : ZIGZAG_DOWN_PATH} fill={tokens.color.paper} />
    </Svg>
  );
}

/**
 * A 1.5px dashed rule. `borderStyle: "dashed"` is unreliable on Android at
 * fractional (non-integer) border widths, so this uses `react-native-svg`
 * (already a dependency) with `strokeDasharray` instead, which renders
 * consistently on both platforms.
 */
function DashedDivider() {
  return (
    <Svg width="100%" height={2} style={styles.divider}>
      <Line
        x1="0"
        y1="1"
        x2="100%"
        y2="1"
        stroke={tokens.color.inkFaintDivider}
        strokeWidth={1.5}
        strokeDasharray="4,3"
      />
    </Svg>
  );
}

const BARCODE_BARS = Array.from({ length: 26 });

function Barcode() {
  return (
    <View style={styles.barcode}>
      {BARCODE_BARS.map((_, i) => (
        <View key={i} style={styles.barcodeBar} />
      ))}
    </View>
  );
}

function ReceiptCard({
  slide,
  slideIndex,
  total,
  marginRight,
}: {
  slide: Slide;
  slideIndex: number;
  total: number;
  marginRight: number;
}) {
  const { Icon, title, body } = slide;
  return (
    <View style={[styles.card, { marginRight }]}>
      <ZigzagEdge direction="up" />
      <View style={styles.cardBody}>
        <Text style={styles.brand}>FİŞLİK</Text>
        <DashedDivider />
        <View style={styles.iconWrap}>
          <Icon size={38} strokeWidth={2} color={tokens.color.primary} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBodyText}>{body}</Text>
        <DashedDivider />
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>ADIM</Text>
          <Text style={styles.metaValue}>
            {slideIndex + 1} / {total}
          </Text>
        </View>
        <Barcode />
      </View>
      <ZigzagEdge direction="down" />
    </View>
  );
}

function Dot({
  slideIndex,
  active,
  anim,
  onPress,
}: {
  slideIndex: number;
  active: boolean;
  anim: Animated.Value;
  onPress: () => void;
}) {
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: [DOT_SIZE, DOT_ACTIVE_WIDTH] });
  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [tokens.color.inkFaintDot, tokens.color.primary],
  });
  return (
    <Pressable
      testID={`tanitim-dot-${slideIndex}`}
      accessibilityRole="button"
      accessibilityLabel={`${slideIndex + 1}. slayt`}
      accessibilityState={{ selected: active }}
      hitSlop={{ top: DOT_HIT_SLOP, bottom: DOT_HIT_SLOP, left: DOT_HIT_SLOP, right: DOT_HIT_SLOP }}
      onPress={onPress}
    >
      {/* `width` (and color) aren't native-drivable, so this animation runs
          on the JS thread (`useNativeDriver: false` below) — passing `true`
          here would throw at runtime. */}
      <Animated.View style={[styles.dot, { width, backgroundColor }]} />
    </Pressable>
  );
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
 *
 * Rendered as a horizontally paged strip of "receipt card" slides
 * (react-native-svg zigzag edges + a fake barcode), 300pt wide with 16pt
 * gaps and neighbor-card peek, per the design handoff. All hooks are
 * declared before the anon/loading/locked guards below, including the
 * ones only meaningful once a role's slide set is known (`slides` falls
 * back to `CLIENT_SLIDES` while `user` is still null) — the guards return
 * different JSX per status, and a real `useAuth()` session does transition
 * loading -> authed on the same mounted instance, so hook count must stay
 * identical across every status.
 */
export default function TanitimScreen() {
  const { status, user } = useAuth();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const dotAnimsRef = useRef<Map<number, Animated.Value>>(new Map());
  const mountedRef = useRef(false);

  const slides = user ? slidesForRole(user.role) : CLIENT_SLIDES;
  const isLast = index === slides.length - 1;

  function dotAnim(i: number): Animated.Value {
    let value = dotAnimsRef.current.get(i);
    if (!value) {
      value = new Animated.Value(i === index ? 1 : 0);
      dotAnimsRef.current.set(i, value);
    }
    return value;
  }

  useEffect(() => {
    // Skip the very first run: each Animated.Value is lazily created (in
    // `dotAnim` above) already holding its correct 0/1 target for the
    // initial `index`, so animating on mount would be a redundant
    // 300ms no-op timer — and a real one, since these aren't
    // native-driven, which is exactly the kind of leftover timer that
    // trips RNTL's "not wrapped in act" warning after a test unmounts.
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    slides.forEach((_, i) => {
      Animated.timing(dotAnim(i), {
        toValue: i === index ? 1 : 0,
        duration: 300,
        // `width` and `backgroundColor` are not native-drivable properties.
        useNativeDriver: false,
      }).start();
    });
    // dotAnim reads/writes a ref map and is stable in identity-of-effect
    // terms; only `index`/slide count changes should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slides.length]);

  if (status === "loading") return <Spinner />;
  if (status === "locked") return <LockedScreen />;
  if (status === "anon" || !user) return <Redirect href="/giris" />;

  function goTo(target: number) {
    const clamped = Math.max(0, Math.min(slides.length - 1, target));
    setIndex(clamped);
    listRef.current?.scrollToOffset({ offset: clamped * SNAP_INTERVAL, animated: true });
  }

  // Snap interval, not window width — a 300pt card + 16pt gap peeking its
  // neighbors means a card's resting scroll offset is a multiple of 316,
  // never a multiple of the screen width.
  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    if (clamped !== index) setIndex(clamped);
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <FislikMark width={16} height={23} />
        <Text style={styles.wordmark}>Fişlik</Text>
      </View>

      <View style={styles.pagerWrap}>
        <FlatList
          testID="tanitim-slides"
          ref={listRef}
          data={slides}
          keyExtractor={(item) => item.key}
          horizontal
          snapToInterval={SNAP_INTERVAL}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          contentContainerStyle={{ paddingHorizontal: CARD_INSET }}
          renderItem={({ item, index: i }) => (
            <ReceiptCard
              slide={item}
              slideIndex={i}
              total={slides.length}
              marginRight={i === slides.length - 1 ? 0 : CARD_GAP}
            />
          )}
        />
      </View>

      <View style={styles.dots}>
        {slides.map((slide, i) => (
          <Dot key={slide.key} slideIndex={i} active={i === index} anim={dotAnim(i)} onPress={() => goTo(i)} />
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={[text.label, styles.skip]} onPress={finish}>
          Geç
        </Text>
        <View style={styles.primaryBtn}>
          {isLast ? (
            <Button title="Başla" onPress={finish} />
          ) : (
            <Button title="İleri" onPress={() => goTo(index + 1)} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.color.page },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 14,
    paddingBottom: 4,
  },
  wordmark: {
    fontFamily: font.extraBold,
    fontSize: 16,
    letterSpacing: -0.4,
    color: tokens.color.ink,
  },
  pagerWrap: { flex: 1, justifyContent: "center" },
  card: { width: CARD_WIDTH },
  cardBody: {
    backgroundColor: tokens.color.paper,
    alignItems: "center",
    gap: 13,
    minHeight: 396,
    paddingTop: 24,
    paddingHorizontal: 26,
    paddingBottom: 18,
    // The zigzag edges are their own tiny SVG shapes; giving the shadow to
    // this rectangular body instead of the whole card (top+body+bottom) is
    // the handoff's explicit fallback when a shadow following the zigzag
    // silhouette isn't feasible.
    shadowColor: tokens.color.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 11,
    elevation: 6,
  },
  divider: { alignSelf: "stretch" },
  brand: {
    fontFamily: font.extraBold,
    fontSize: 11,
    letterSpacing: 3,
    color: tokens.color.primary,
  },
  iconWrap: { paddingTop: 8 },
  cardTitle: {
    fontFamily: font.bold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: tokens.color.ink,
    textAlign: "center",
  },
  cardBodyText: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 22,
    color: tokens.color.inkSoft,
    textAlign: "center",
    flex: 1,
  },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignSelf: "stretch" },
  metaLabel: { fontFamily: font.medium, fontSize: 11.5, color: tokens.color.inkSoft },
  metaValue: { fontFamily: font.bold, fontSize: 11.5, color: tokens.color.ink },
  barcode: { width: 130, height: 24, flexDirection: "row", alignItems: "center", gap: 3, opacity: 0.6 },
  barcodeBar: { width: 2, height: 24, backgroundColor: tokens.color.ink },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 16 },
  dot: { height: DOT_SIZE, borderRadius: tokens.radius.pill },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.space(5),
    paddingVertical: tokens.space(5),
    gap: tokens.space(3),
  },
  skip: { color: tokens.color.inkSoft, padding: tokens.space(2) },
  primaryBtn: { minWidth: 132 },
});
