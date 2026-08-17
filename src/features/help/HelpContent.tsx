import { ScrollView, StyleSheet, Text } from "react-native";
import type { Role } from "@/src/api/endpoints";
import { Button } from "@/src/theme/components/Button";
import { Card } from "@/src/theme/components/Card";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

interface HelpStep {
  title: string;
  body: string;
}

/**
 * Describes what the user does and what happens as a result, not what the
 * buttons are called, so this page survives a label change — e.g. "the
 * month's receipts" rather than quoting "Muhasebeciye gönder" verbatim.
 * Mirrors the client home screen (`app/(client)/(fisler)/index.tsx`), the receipt
 * detail screen's issue channel (`src/features/receipts/IssueSection.tsx`)
 * and `SubmissionRow`'s send/locked-month behaviour — there is no web
 * counterpart to port from.
 */
const CLIENT_STEPS: HelpStep[] = [
  {
    title: "Fiş çekin",
    body: "Ana sayfadaki kamera düğmesine dokunarak fişinizi fotoğraflarsınız; art arda birden fazla fiş çekip biriktirebilirsiniz.",
  },
  {
    title: "Ayı seçin",
    body: "Üstteki ay seçiciden fişin ait olduğu ayı seçersiniz; çektiğiniz her fiş seçili aya kaydedilir. Muhasebeciniz bir ayı kapatmışsa bu geçerli değildir: o aya çektiğiniz fiş otomatik olarak bir sonraki açık aya kaydedilir ve o fişin ayını siz de değiştiremezsiniz.",
  },
  {
    title: "Ayı gönderin",
    body: "O aya ait fişlerinizi hazırladığınızda düğmeye dokunarak fişlerinizi muhasebecinize gönderirsiniz; gönderim tarihi, fiş listesinin üstünde bir onay rozeti olarak görünür. Gönderdikten sonra fiş eklerseniz veya silerseniz, ay yeniden gönderilebilir hale gelir.",
  },
  {
    title: "Bildirilen bir sorunu çözün",
    body: "Muhasebeciniz bir fişte sorun bildirirse, fiş listede açık sorunuyla birlikte görünür; fiş detayına girip gerekli düzeltmeyi yaptıktan sonra sorunu çözüldü olarak işaretleyip kapatırsınız.",
  },
];

/** See `CLIENT_STEPS`'s docstring. Mirrors `app/(accountant)/(mukellefler)/index.tsx`, the
 * per-client month screen (`app/(accountant)/(mukellefler)/mukellef/[clientId].tsx`) —
 * mark-processed, month-locking, the ZIP export — and `GrantsSection`'s
 * accountant-side invite form.
 */
const ACCOUNTANT_STEPS: HelpStep[] = [
  {
    title: "Mükellef davet edin",
    body: "Mükellefler ekranındaki formdan mükellefinizin e-posta adresini girip davet gönderirsiniz; mükellefiniz daveti kabul ettiğinde fişlerine erişirsiniz.",
  },
  {
    title: "Fişleri işlenmiş olarak işaretleyin",
    body: "Tek bir fişi uzun basarak işlenmiş olarak işaretlersiniz; birden çok fişi aynı anda işaretlemek için toplu işaretleme düğmesini kullanırsınız. Aynı işlemi tekrarlayarak işareti geri alabilirsiniz.",
  },
  {
    title: "Ayı kapatın",
    body: "Mükellefin ayını kapatmak için ay durumundaki düğmeye dokunursunuz; kapatılan ayda mükellef fiş silemez, düzenleyemez ve ayını değiştiremez, bu aya göndereceği yeni fişler otomatik olarak bir sonraki açık aya eklenir. Siz düzenlemeye devam edebilirsiniz ve ayı istediğiniz zaman yeniden açabilirsiniz.",
  },
  {
    title: "Arşivi dışa aktarın",
    body: "Ayın tüm fişlerini ZIP olarak indirmek istediğinizde paylaşım ekranı açılır; oradan dosyayı istediğiniz uygulamaya kaydedebilir veya gönderebilirsiniz. O ay için indirilecek fiş yoksa ya da cihazda paylaşılacak bir uygulama yoksa bunu bildiren bir mesaj görürsünüz.",
  },
];

const STEPS_BY_ROLE: Record<Role, HelpStep[]> = {
  client: CLIENT_STEPS,
  accountant: ACCOUNTANT_STEPS,
};

/**
 * Role-aware help page, reachable from Profil at any time — not just on
 * first launch. A plain scrolling list of numbered `Card`s, no input, so
 * (unlike `profil.tsx`) it doesn't need `AuthShell`'s
 * `KeyboardAvoidingView` pairing.
 */
export function HelpContent({
  role,
  onReplayIntro,
}: {
  role: Role;
  onReplayIntro: () => void | Promise<void>;
}) {
  const steps = STEPS_BY_ROLE[role];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={[text.title, styles.title]}>Nasıl kullanılır</Text>
      {steps.map((step, index) => (
        <Card key={step.title} style={styles.card}>
          <Text style={[text.label, styles.stepTitle]}>{`${index + 1}. ${step.title}`}</Text>
          <Text style={[text.body, styles.stepBody]}>{step.body}</Text>
        </Card>
      ))}
      <Card style={styles.card}>
        <Text style={[text.label, styles.stepTitle]}>Tanıtımı yeniden izleyin</Text>
        <Text style={[text.body, styles.stepBody]}>
          Uygulamayı tanıtan kısa turu yeniden görmek isterseniz aşağıdaki düğmeye dokunun.
        </Text>
        <Button title="Tanıtım turunu tekrar izle" variant="secondary" onPress={onReplayIntro} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.color.page },
  content: { gap: tokens.space(3), padding: tokens.space(3), paddingBottom: tokens.space(8) },
  title: { color: tokens.color.ink },
  card: { gap: tokens.space(1.5) },
  stepTitle: { color: tokens.color.ink },
  stepBody: { color: tokens.color.inkSoft },
});
