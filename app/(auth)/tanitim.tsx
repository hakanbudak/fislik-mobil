import { useRef, useState } from "react";
import { router } from "expo-router";
import { Camera, CloudOff, Send, Radar } from "lucide-react-native";
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { markIntroSeen } from "@/src/onboarding/introSeen";
import { Button } from "@/src/theme/components/Button";
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
 * The four-slide first-launch tour — see `src/onboarding/introSeen.ts` for
 * the "seen" flag it writes on the way out. Slide four is the one that
 * matters most: it's the only place a user learns captures survive a
 * dropped connection instead of assuming they were lost.
 *
 * Formal register ("fişinizi", "biriktirirsiniz"), matching the web's own
 * established voice (`fislik-web/src/pages/*.tsx` is formal throughout,
 * bar one inconsistent empty-state string) — this page has no web
 * counterpart, but the mobile app's own Yardım page (Task 6) that now
 * links straight into this tour is formal too, and the two should not
 * clash on register in the same flow.
 */
const SLIDES: Slide[] = [
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
    body: "Fişleriniz okundu mu, işlendi mi — hepsi listede görünür.",
  },
  {
    key: "cevrimdisi",
    Icon: CloudOff,
    title: "İnternet olmasa da çalışır",
    body: "Çekimler telefonda bekler, bağlantı gelince kendiliğinden yüklenir.",
  },
];

/**
 * `router.replace("/")` — the app's own entry route, not a hardcoded
 * `/giris` — because this tour is no longer only a first-launch/anonymous
 * flow: the help page (Task 6) lets an authed user replay it from Profil.
 * `app/index.tsx` already does exactly the dispatch this exit needs (anon
 * -> `/giris`, an authed client/accountant -> their own tab group, locked
 * -> the lock screen), and since `markIntroSeen()` is awaited first, an
 * anon session's landing there re-reads the flag as already "seen" and
 * goes straight to `/giris` rather than bouncing back into this screen.
 * Hardcoding `/giris` here previously stranded an authed replay on the
 * login form with a valid session and no way back short of force-quitting.
 */
async function finish() {
  await markIntroSeen();
  router.replace("/");
}

export default function TanitimScreen() {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const isLast = index === SLIDES.length - 1;

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  }

  return (
    <View style={styles.page}>
      <FlatList
        testID="tanitim-slides"
        ref={listRef}
        data={SLIDES}
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
        {SLIDES.map((slide, i) => (
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
