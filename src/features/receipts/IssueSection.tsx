import { useState } from "react";
import { TriangleAlert } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import type { IssueOut } from "@/src/api/endpoints";
import { formatDateTime } from "@/src/lib/dates";
import { apiErrorMessage } from "@/src/lib/errors";
import { Button } from "@/src/theme/components/Button";
import { Card } from "@/src/theme/components/Card";
import { Input } from "@/src/theme/components/Input";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * The issue-reporting/resolution channel on a receipt's detail screen —
 * "this one is unreadable" / "this belongs to another month". Mirrors
 * `fislik-web`'s pieces: `AccountantMonthPage`'s "Sorun bildir" modal (open)
 * and `ReceiptDrawer`'s open-issue card (the "AÇIK SORUN · {author} ·
 * {date}" copy this card's header borrows).
 *
 * `onResolve` is deliberately OPTIONAL, not a design choice this component
 * gets to make on its own: `fislik-api/app/modules/issues/router.py` gates
 * `open_issue` to `AccountantUser` and `resolve_issue` to `ClientUser` (plus
 * an ownership check) — an accountant calling resolve gets a 403, always.
 * So the accountant's screen renders this component WITHOUT `onResolve`
 * (report-only); a client-facing screen wanting the resolve action would
 * pass `onResolve` and omit reporting UI entirely (there is currently no
 * such screen — `app/(client)/fis/[id].tsx` implements its own resolve
 * button directly rather than going through this component, since it has
 * no reporting UI to share with the accountant's "Sorun bildir" flow).
 *
 * Owns its own composer/submit/resolve state and turns a rejected
 * `onOpen`/`onResolve` into inline Turkish copy via `apiErrorMessage` —
 * same division of labour as `ExtractionEditor`'s `onSave`. The caller only
 * has to supply the API call(s) and invalidate its queries on success.
 */
export function IssueSection({
  issue,
  onOpen,
  onResolve,
}: {
  issue: IssueOut | null;
  onOpen: (message: string) => void | Promise<void>;
  onResolve?: () => void | Promise<void>;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  function openComposer() {
    setMessage("");
    setValidationError(null);
    setSubmitError(null);
    setComposerOpen(true);
  }

  async function handleSubmit() {
    const trimmed = message.trim();
    if (trimmed === "") {
      setValidationError("Lütfen sorunu açıklayın");
      return;
    }
    setValidationError(null);
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onOpen(trimmed);
      setComposerOpen(false);
      setMessage("");
    } catch (err) {
      // A 409 here means the receipt already has an open issue — matches
      // fislik-web/src/pages/AccountantMonthPage.tsx's own override.
      setSubmitError(apiErrorMessage(err, { 409: "Bu fişte zaten açık bir sorun var" }));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve() {
    if (!onResolve) return;
    setResolveError(null);
    setResolving(true);
    try {
      await onResolve();
    } catch (err) {
      setResolveError(apiErrorMessage(err));
    } finally {
      setResolving(false);
    }
  }

  if (issue) {
    return (
      <Card style={styles.issueCard}>
        <View style={styles.issueHeader}>
          <TriangleAlert size={16} color={tokens.color.warning} />
          <Text style={[text.label, styles.issueHeaderText]}>
            {`AÇIK SORUN · ${issue.author_name} · ${formatDateTime(issue.created_at)}`}
          </Text>
        </View>
        <Text style={[text.body, styles.issueMessage]}>{issue.message}</Text>
        {onResolve ? (
          <>
            {resolveError ? <Text style={[text.caption, styles.error]}>{resolveError}</Text> : null}
            <Button
              title="Çözüldü olarak işaretle"
              variant="secondary"
              onPress={handleResolve}
              loading={resolving}
              busyTitle="İşaretleniyor…"
            />
          </>
        ) : null}
      </Card>
    );
  }

  if (!composerOpen) {
    return (
      <Card style={styles.section}>
        <Button title="Sorun bildir" variant="secondary" onPress={openComposer} />
      </Card>
    );
  }

  return (
    <Card style={styles.section}>
      <Input
        label="Sorun mesajı"
        value={message}
        onChangeText={(v) => {
          setMessage(v);
          if (validationError) setValidationError(null);
        }}
        multiline
        numberOfLines={4}
        placeholder="Mükellefe iletilecek kısa not…"
        error={validationError ?? undefined}
      />
      {submitError ? <Text style={[text.caption, styles.error]}>{submitError}</Text> : null}
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Button title="Vazgeç" variant="secondary" onPress={() => setComposerOpen(false)} />
        </View>
        <View style={styles.rowItem}>
          <Button
            title="Sorunu gönder"
            onPress={handleSubmit}
            loading={submitting}
            busyTitle="Gönderiliyor…"
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.space(3) },
  row: { flexDirection: "row", gap: tokens.space(2.5) },
  rowItem: { flex: 1 },
  issueCard: { gap: tokens.space(2), borderColor: tokens.color.warning },
  issueHeader: { flexDirection: "row", alignItems: "center", gap: tokens.space(1.5) },
  issueHeaderText: { color: tokens.color.warning, flex: 1 },
  issueMessage: { color: tokens.color.ink },
  error: { color: tokens.color.danger },
});
