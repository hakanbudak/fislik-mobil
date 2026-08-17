import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  clientReceipts,
  openIssue,
  patchExtraction,
  retryExtraction,
  type ExtractionPatchIn,
} from "@/src/api/endpoints";
import { queryKeys } from "@/src/api/queryKeys";
import { ExtractionEditor } from "@/src/features/receipts/ExtractionEditor";
import { IssueSection } from "@/src/features/receipts/IssueSection";
import { ReceiptViewer } from "@/src/features/receipts/ReceiptViewer";
import { apiErrorMessage } from "@/src/lib/errors";
import { currentPeriod } from "@/src/lib/period";
import { EmptyState } from "@/src/theme/components/EmptyState";
import { ErrorCard } from "@/src/theme/components/ErrorCard";
import { Spinner } from "@/src/theme/components/Spinner";
import { Toast } from "@/src/theme/components/Toast";
import { tokens } from "@/src/theme/tokens";

/**
 * The accountant's "Fiş detayı" screen — the sibling of `app/(client)/fis/[id].tsx`,
 * closing the route `app/(accountant)/mukellef/[clientId].tsx` has pushed to
 * since Task 22 (`mukellef/[clientId]/fis/[id]`). Reuses the same
 * `ReceiptViewer`/`ExtractionEditor` pair the client's screen does, and adds
 * `IssueSection` — the accountant's side of Task 17's issue flag.
 *
 * Differences from the client's screen, deliberate:
 * - The receipt is read off `queryKeys.clientReceipts(clientId, period)`
 *   (the accountant's own scoped listing), never `queryKeys.receipts` — the
 *   two never share a cache, on-device or across users.
 * - No period lock gate: `fislik-web/src/pages/AccountantMonthPage.tsx`'s
 *   docstring is explicit that "the accountant may keep editing throughout"
 *   a locked month, so `readOnly` is never set here.
 * - No delete / "Ayı değiştir" actions — Task 25's interfaces only call for
 *   the viewer, the editor, and the issue channel; the client's screen owns
 *   receipt lifecycle actions the accountant does not have here.
 * - `IssueSection` is rendered WITHOUT `onResolve` here — resolving is
 *   correctness, not preference: `fislik-api/app/modules/issues/router.py`
 *   gates `resolve_issue` to `ClientUser` (plus an ownership check), so an
 *   accountant calling it always 403s. The client's own screen
 *   (`app/(client)/fis/[id].tsx`) owns the resolve action instead.
 */
export default function ReceiptDetailScreen() {
  const { clientId, id, period: periodParam } = useLocalSearchParams<{
    clientId: string;
    id: string;
    period?: string;
  }>();
  const period = periodParam ?? currentPeriod();
  const queryClient = useQueryClient();

  const [toast, setToast] = useState<string | null>(null);

  const receiptsQuery = useQuery({
    queryKey: queryKeys.clientReceipts(clientId, period),
    queryFn: () => clientReceipts(clientId, period),
    retry: false,
  });
  const receipt = receiptsQuery.data?.find((r) => r.id === id);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.clientReceipts(clientId, period) });
  }

  const patchMutation = useMutation({
    mutationFn: (patch: ExtractionPatchIn) => patchExtraction(id, patch),
    onSuccess: invalidate,
  });

  const retryMutation = useMutation({
    mutationFn: () => retryExtraction(id),
    onSuccess: invalidate,
    // Same override as the client's screen (`app/(client)/fis/[id].tsx`):
    // a 409 here means this receipt was hand-edited, not that retry was
    // already attempted — the generic "Bu işlem zaten yapılmış." would say
    // the wrong thing.
    onError: (error) =>
      setToast(apiErrorMessage(error, { 409: "Bu fiş elle düzenlendiği için yeniden analiz edilemez." })),
  });

  const openIssueMutation = useMutation({
    mutationFn: (message: string) => openIssue(clientId, id, message),
    onSuccess: () => {
      invalidate();
      setToast("Sorun bildirildi");
    },
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

      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.viewerWrap}>
            <ReceiptViewer receipt={receipt} />
          </View>

          <IssueSection
            issue={receipt.open_issue}
            onOpen={async (message) => {
              await openIssueMutation.mutateAsync(message);
            }}
          />

          <ExtractionEditor
            receiptId={receipt.id}
            extraction={receipt.extraction ?? null}
            onSave={async (patch) => {
              await patchMutation.mutateAsync(patch);
            }}
            onRetry={() => retryMutation.mutate()}
          />
        </ScrollView>
      </KeyboardAvoidingView>

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
  keyboardAvoider: { flex: 1 },
  scroll: { gap: tokens.space(3), padding: tokens.space(3), paddingTop: 0, paddingBottom: tokens.space(8) },
  viewerWrap: { height: 360, borderRadius: tokens.radius.lg, overflow: "hidden" },
});
