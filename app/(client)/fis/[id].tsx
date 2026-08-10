import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/src/api/client";
import {
  changePeriod,
  deleteReceipt,
  listReceipts,
  patchExtraction,
  periodLockStatus,
  resolveIssue,
  retryExtraction,
  type ExtractionPatchIn,
  type PeriodLockOut,
} from "@/src/api/endpoints";
import { queryKeys } from "@/src/api/queryKeys";
import { ExtractionEditor } from "@/src/features/receipts/ExtractionEditor";
import { ReceiptViewer } from "@/src/features/receipts/ReceiptViewer";
import { apiErrorMessage } from "@/src/lib/errors";
import { currentPeriod, formatPeriodLabel } from "@/src/lib/period";
import { mismatchedPeriod } from "@/src/lib/receiptReview";
import { Button } from "@/src/theme/components/Button";
import { Card } from "@/src/theme/components/Card";
import { EmptyState } from "@/src/theme/components/EmptyState";
import { ErrorCard } from "@/src/theme/components/ErrorCard";
import { MonthPicker } from "@/src/theme/components/MonthPicker";
import { Spinner } from "@/src/theme/components/Spinner";
import { Toast } from "@/src/theme/components/Toast";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * Client's "Fiş detayı" screen — ported from
 * fislik-web/src/pages/ReceiptDetailPage.tsx, minus the desktop prev/next
 * receipt navigation (`ReceiptViewer`'s toolbar has no mobile equivalent
 * yet).
 *
 * Owns the open-issue "resolve" action — `fislik-api/app/modules/issues/router.py`
 * gates `resolve_issue` to `ClientUser` (plus an ownership check), so this
 * is the only screen in the app that is allowed to call it; the
 * accountant's own receipt-detail screen
 * (`app/(accountant)/mukellef/[clientId]/fis/[id].tsx`) deliberately omits
 * it. `issueResolved` mirrors the web's own optimistic flag
 * (`ReceiptDetailPage.tsx`'s `issueResolved` state): it hides the card the
 * instant the mutation succeeds, without waiting on the `receipts`
 * invalidation's refetch to land.
 *
 * There is no single-receipt API endpoint, so this screen locates the
 * receipt inside the `queryKeys.receipts(period)` list — the same query key
 * the home screen (`app/(client)/index.tsx`) already populates. When that
 * cache is warm (the common case: tapped from `<ReceiptCard>`), `useQuery`
 * resolves instantly from cache; when it's cold (a deep link, or a cold
 * start straight onto this route), the same query call transparently
 * refetches the list. `period` itself comes off the route's `?period=`
 * param, set by the card's navigation — a deep link without it falls back
 * to the current month.
 */
export default function ReceiptDetailScreen() {
  const { id, period: periodParam } = useLocalSearchParams<{ id: string; period?: string }>();
  const period = periodParam ?? currentPeriod();
  const queryClient = useQueryClient();

  const [toast, setToast] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [changingPeriod, setChangingPeriod] = useState(false);
  const [tempPeriod, setTempPeriod] = useState(period);
  const [issueResolved, setIssueResolved] = useState(false);

  const receiptsQuery = useQuery({
    queryKey: queryKeys.receipts(period),
    queryFn: () => listReceipts(period),
    retry: false,
  });
  const receipt = receiptsQuery.data?.find((r) => r.id === id);

  // Must fail soft — a 404 means this API predates the endpoint and reads
  // as "not locked", not a broken screen (mirrors the home screen's query).
  const lockQuery = useQuery({
    queryKey: queryKeys.periodLock(period),
    queryFn: async (): Promise<PeriodLockOut> => {
      try {
        return await periodLockStatus(period);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return { locked: false, locked_at: null };
        }
        throw error;
      }
    },
    retry: false,
  });
  const locked = lockQuery.data?.locked === true;

  /**
   * A receipt's submission state for a month depends on what is filed in
   * it, so every mutation here invalidates `receipts`/`summary` for every
   * period it touches, and `submission` too. A period change touches TWO
   * months (the one the receipt left, the one it landed in); every other
   * mutation only ever touches this screen's own `period`.
   */
  function invalidatePeriod(p: string) {
    queryClient.invalidateQueries({ queryKey: queryKeys.receipts(p) });
    queryClient.invalidateQueries({ queryKey: queryKeys.summary(p) });
    queryClient.invalidateQueries({ queryKey: queryKeys.submission(p) });
  }

  const patchMutation = useMutation({
    mutationFn: (patch: ExtractionPatchIn) => patchExtraction(id, patch),
    onSuccess: () => invalidatePeriod(period),
  });

  const retryMutation = useMutation({
    mutationFn: () => retryExtraction(id),
    onSuccess: () => invalidatePeriod(period),
    // The API 409s retry on a receipt whose extraction was hand-edited
    // (Task 16 made accidental edits much harder, so this now almost always
    // reflects a genuine earlier edit, not a repeated retry). The generic
    // "Bu işlem zaten yapılmış." default would tell the user they already
    // retried, which is wrong and doesn't explain why retry is unavailable.
    onError: (error) =>
      setToast(
        apiErrorMessage(error, { 409: "Bu fiş elle düzenlendiği için yeniden analiz edilemez." }),
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteReceipt(id),
    onSuccess: () => {
      invalidatePeriod(period);
      router.back();
    },
    onError: (error) => setToast(apiErrorMessage(error)),
  });

  const changePeriodMutation = useMutation({
    mutationFn: (next: string) => changePeriod(id, next),
    onSuccess: (_updated, next) => {
      invalidatePeriod(period);
      invalidatePeriod(next);
      router.back();
    },
    onError: (error) => setToast(apiErrorMessage(error)),
  });

  const resolveIssueMutation = useMutation({
    mutationFn: (issueId: string) => resolveIssue(issueId),
    onSuccess: () => {
      setIssueResolved(true);
      invalidatePeriod(period);
    },
    onError: (error) => setToast(apiErrorMessage(error)),
  });

  if (receiptsQuery.isLoading) {
    return (
      <View style={styles.center}>
        <Spinner />
      </View>
    );
  }

  if (receiptsQuery.isError) {
    return (
      <View style={styles.center}>
        <ErrorCard message={apiErrorMessage(receiptsQuery.error)} onRetry={() => receiptsQuery.refetch()} />
      </View>
    );
  }

  if (!receipt) {
    return (
      <View style={styles.center}>
        <EmptyState title="Fiş bulunamadı" description="Bu fiş kaldırılmış veya taşınmış olabilir." />
      </View>
    );
  }

  const wrongMonth = mismatchedPeriod(receipt.extraction?.receipt_date ?? null, receipt.period);
  const activeIssue = issueResolved ? null : receipt.open_issue;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <ArrowLeft size={18} color={tokens.color.inkSoft} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.viewerWrap}>
          <ReceiptViewer receipt={receipt} />
        </View>

        {locked ? (
          <Card style={styles.notice}>
            <Text style={[text.body, styles.noticeText]}>
              Bu ay muhasebeciniz tarafından kapatıldı, düzenleme yapılamaz.
            </Text>
          </Card>
        ) : null}

        {wrongMonth ? (
          <Card style={styles.notice}>
            <View style={styles.noticeHeader}>
              <TriangleAlert size={16} color={tokens.color.warning} />
              <Text style={[text.body, styles.noticeText]}>
                {`${formatPeriodLabel(wrongMonth)} tarihli bu fiş ${formatPeriodLabel(
                  receipt.period,
                )} ayına kaydedilmiş. "Ayı değiştir" ile düzeltebilirsiniz.`}
              </Text>
            </View>
          </Card>
        ) : null}

        {activeIssue ? (
          <Card style={styles.notice}>
            <View style={styles.noticeHeader}>
              <TriangleAlert size={16} color={tokens.color.danger} />
              <Text style={[text.label, styles.issueTitle]}>Muhasebeciniz sorun bildirdi</Text>
            </View>
            <Text style={[text.body, styles.noticeText]}>{activeIssue.message}</Text>
            <Text style={[text.caption, styles.issueAuthor]}>{activeIssue.author_name}</Text>
            <Button
              title="Çözüldü olarak işaretle"
              variant="danger"
              onPress={() => resolveIssueMutation.mutate(activeIssue.id)}
              loading={resolveIssueMutation.isPending}
              busyTitle="İşaretleniyor…"
            />
          </Card>
        ) : null}

        <ExtractionEditor
          extraction={receipt.extraction ?? null}
          readOnly={locked}
          onSave={async (patch) => {
            await patchMutation.mutateAsync(patch);
          }}
          onRetry={() => retryMutation.mutate()}
        />

        {!locked ? (
          <View style={styles.periodRow}>
            <View>
              <Text style={[text.caption, styles.periodLabel]}>AY</Text>
              <Text style={[text.label, styles.periodValue]}>{formatPeriodLabel(receipt.period)}</Text>
            </View>
            <Button
              title="Ayı değiştir"
              variant="secondary"
              onPress={() => {
                changePeriodMutation.reset();
                setTempPeriod(receipt.period);
                setChangingPeriod(true);
              }}
            />
          </View>
        ) : null}

        {changingPeriod ? (
          <Card style={styles.confirmCard}>
            <MonthPicker value={tempPeriod} onChange={setTempPeriod} />
            <View style={styles.confirmRow}>
              <View style={styles.confirmButton}>
                <Button title="Vazgeç" variant="secondary" onPress={() => setChangingPeriod(false)} />
              </View>
              <View style={styles.confirmButton}>
                <Button
                  title="Onayla"
                  onPress={() => changePeriodMutation.mutate(tempPeriod)}
                  loading={changePeriodMutation.isPending}
                  disabled={tempPeriod === receipt.period}
                />
              </View>
            </View>
          </Card>
        ) : null}

        {!locked ? (
          <Button
            title="Fişi sil"
            variant="danger"
            onPress={() => {
              deleteMutation.reset();
              setConfirmingDelete(true);
            }}
          />
        ) : null}

        {confirmingDelete ? (
          <Card style={styles.confirmCard}>
            <Text style={[text.body, styles.confirmText]}>Bu fiş silinecek. Emin misiniz?</Text>
            <View style={styles.confirmRow}>
              <View style={styles.confirmButton}>
                <Button title="Vazgeç" variant="secondary" onPress={() => setConfirmingDelete(false)} />
              </View>
              <View style={styles.confirmButton}>
                <Button
                  title="Sil"
                  variant="danger"
                  onPress={() => deleteMutation.mutate()}
                  loading={deleteMutation.isPending}
                />
              </View>
            </View>
          </Card>
        ) : null}
      </ScrollView>

      <Toast message={toast} onHide={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.color.page },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.color.page },
  header: { flexDirection: "row", padding: tokens.space(3) },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.card,
  },
  scroll: { gap: tokens.space(3), padding: tokens.space(3), paddingTop: 0, paddingBottom: tokens.space(8) },
  viewerWrap: { height: 360, borderRadius: tokens.radius.lg, overflow: "hidden" },
  notice: { gap: tokens.space(1.5) },
  noticeHeader: { flexDirection: "row", alignItems: "flex-start", gap: tokens.space(2) },
  noticeText: { color: tokens.color.ink, flex: 1 },
  issueTitle: { color: tokens.color.danger },
  issueAuthor: { color: tokens.color.inkSoft },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.space(3.5),
  },
  periodLabel: { color: tokens.color.inkSoft },
  periodValue: { color: tokens.color.ink, marginTop: tokens.space(0.5) },
  confirmCard: { gap: tokens.space(3), alignItems: "center" },
  confirmText: { color: tokens.color.ink, textAlign: "center" },
  confirmRow: { flexDirection: "row", gap: tokens.space(2.5), width: "100%" },
  confirmButton: { flex: 1 },
});
