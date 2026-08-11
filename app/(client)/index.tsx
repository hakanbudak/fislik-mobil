import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/src/api/client";
import {
  getSubmissionState,
  listReceipts,
  periodLockStatus,
  receiptsSummary,
  submitReceipts,
  type PeriodLockOut,
  type ReceiptOut,
} from "@/src/api/endpoints";
import { queryKeys } from "@/src/api/queryKeys";
import { MonthSummaryCard } from "@/src/features/receipts/MonthSummaryCard";
import { QueuedReceiptCard } from "@/src/features/receipts/QueuedReceiptCard";
import { ReceiptCard } from "@/src/features/receipts/ReceiptCard";
import { SubmissionRow } from "@/src/features/receipts/SubmissionRow";
import { apiErrorMessage } from "@/src/lib/errors";
import { currentPeriod } from "@/src/lib/period";
import { EmptyState } from "@/src/theme/components/EmptyState";
import { ErrorCard } from "@/src/theme/components/ErrorCard";
import { MonthPicker } from "@/src/theme/components/MonthPicker";
import { Spinner } from "@/src/theme/components/Spinner";
import { Toast } from "@/src/theme/components/Toast";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";
import { useUploadQueue } from "@/src/upload/useUploadQueue";
import type { QueueRecord } from "@/src/upload/queue";

type Row = { key: string } & ({ kind: "queued"; record: QueueRecord } | { kind: "receipt"; receipt: ReceiptOut });

export default function HomeScreen() {
  const [period, setPeriod] = useState(currentPeriod());
  const [toast, setToast] = useState<string | null>(null);
  const { queued, retry, discard } = useUploadQueue(period);
  const queryClient = useQueryClient();

  const receiptsQuery = useQuery({
    queryKey: queryKeys.receipts(period),
    queryFn: () => listReceipts(period),
    retry: false,
  });

  const summaryQuery = useQuery({
    queryKey: queryKeys.summary(period),
    queryFn: () => receiptsSummary(period),
    retry: false,
  });

  // A 404 means this API predates the endpoint — that must read as "not
  // locked" rather than break the receipt list below.
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
  const monthLocked = lockQuery.data?.locked === true;

  const submissionQuery = useQuery({
    queryKey: queryKeys.submission(period),
    queryFn: () => getSubmissionState(period),
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: () => submitReceipts(period),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.submission(period) });
      setToast("Muhasebeciye gönderildi");
    },
    onError: (error) => {
      // Re-invalidate on failure too (e.g. a 409 — already sent by another
      // device) so the row and badge settle to the server's true state
      // instead of staying stuck on stale data.
      queryClient.invalidateQueries({ queryKey: queryKeys.submission(period) });
      setToast(apiErrorMessage(error));
    },
  });

  const receipts = receiptsQuery.data ?? [];
  const rows: Row[] = [
    ...queued.map((record) => ({ key: `q-${record.id}`, kind: "queued" as const, record })),
    ...receipts.map((receipt) => ({ key: `r-${receipt.id}`, kind: "receipt" as const, receipt })),
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MonthPicker value={period} onChange={setPeriod} />
      </View>

      {submissionQuery.data ? (
        <SubmissionRow
          state={submissionQuery.data}
          onSubmit={() => submitMutation.mutate()}
          busy={submitMutation.isPending}
        />
      ) : null}

      {monthLocked ? (
        <View style={styles.notice}>
          <Text style={[text.caption, styles.noticeText]}>
            Bu ay muhasebeciniz tarafından kapatıldı. Yeni yüklemeler bir sonraki aya kaydedilir.
          </Text>
        </View>
      ) : null}

      {summaryQuery.data ? <MonthSummaryCard summary={summaryQuery.data} /> : null}
      {summaryQuery.isError ? (
        <ErrorCard message="Özet yüklenemedi" onRetry={() => summaryQuery.refetch()} />
      ) : null}

      {receiptsQuery.isLoading ? (
        <Spinner />
      ) : receiptsQuery.isError ? (
        <ErrorCard message="Fişler yüklenemedi" onRetry={() => receiptsQuery.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="Bu ay için henüz fiş yok" description="Kameraya dokunarak ilk fişini ekle." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          numColumns={2}
          contentContainerStyle={styles.list}
          renderItem={({ item }) =>
            item.kind === "queued" ? (
              <QueuedReceiptCard
                record={item.record}
                onRetry={() => retry(item.record.id)}
                onDiscard={() => discard(item.record.id)}
              />
            ) : (
              <ReceiptCard
                receipt={item.receipt}
                onPress={() =>
                  router.push({
                    pathname: "/(client)/fis/[id]",
                    params: { id: item.receipt.id, period: item.receipt.period },
                  })
                }
              />
            )
          }
        />
      )}

      <Toast message={toast} onHide={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.color.page, padding: tokens.space(3), gap: tokens.space(3) },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  notice: {
    backgroundColor: `${tokens.color.warning}1A`,
    borderRadius: tokens.radius.md,
    padding: tokens.space(2.5),
  },
  noticeText: { color: tokens.color.ink },
  list: { paddingBottom: tokens.space(20) },
});
