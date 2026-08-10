import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/src/api/client";
import {
  bulkMarkProcessed,
  bulkUnmarkProcessed,
  clientReceipts,
  getClientCompany,
  lockPeriod,
  markProcessed,
  periodLockStatus,
  unlockPeriod,
  unmarkProcessed,
  type CompanyOut,
  type PeriodLockOut,
  type ReceiptOut,
} from "@/src/api/endpoints";
import { queryKeys } from "@/src/api/queryKeys";
import { ReceiptCard } from "@/src/features/receipts/ReceiptCard";
import { apiErrorMessage } from "@/src/lib/errors";
import { currentPeriod, formatPeriodLabel } from "@/src/lib/period";
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
 * The accountant's "one client, one month" working screen — mirrors
 * `fislik-web/src/pages/AccountantMonthPage.tsx`, but only the parts that
 * have a mobile counterpart: the header, the company card, the receipt
 * grid, and processed-marking. The filter bar, export modal, receipt
 * drawer, keyboard navigation and the desktop review table are deliberately
 * NOT ported — see the Task 22 brief for why.
 *
 * `period` lives in the route param, never shadowed into local state —
 * `setPeriod` below calls `router.setParams` so the URL stays the single
 * source of truth, matching how `period` itself is read.
 *
 * Header title: the web's equivalent (`clientTitle`) prefers a name passed
 * via React Router `location.state` from the client list
 * (`AccountantClientsPage.tsx` navigates with `state: { fullName:
 * client.full_name, period }`), falling back to
 * `company?.trade_name ?? company?.full_name ?? "Mükellef"`. Expo Router has
 * no router-state equivalent, so `app/(accountant)/index.tsx` threads the
 * same name through as a `full_name` route param instead — this screen
 * prefers that param so the header paints the real name on first frame, no
 * flash, and only falls back to the company query's chain for a deep link
 * or cold start where the param is absent (matching the web's own fallback
 * order beyond its state).
 */
export default function ClientMonthScreen() {
  const {
    clientId,
    period: periodParam,
    full_name: fullNameParam,
  } = useLocalSearchParams<{ clientId: string; period?: string; full_name?: string }>();
  const period = periodParam ?? currentPeriod();
  const queryClient = useQueryClient();

  const [companyExpanded, setCompanyExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmingLock, setConfirmingLock] = useState(false);

  function setPeriod(next: string) {
    router.setParams({ period: next });
  }

  const receiptsQuery = useQuery({
    queryKey: queryKeys.clientReceipts(clientId, period),
    queryFn: () => clientReceipts(clientId, period),
    retry: false,
  });

  // A 404 means this client never filled in their company profile — that's
  // not an error, it just means the card below has nothing to show, same
  // pattern as `getCompany`'s handling in `app/(client)/firma-bilgileri.tsx`.
  const companyQuery = useQuery({
    queryKey: queryKeys.clientCompany(clientId),
    queryFn: async (): Promise<CompanyOut | null> => {
      try {
        return await getClientCompany(clientId);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    retry: false,
  });
  const company = companyQuery.data ?? null;
  const clientTitle = fullNameParam ?? company?.trade_name ?? company?.full_name ?? "Mükellef";

  // Month-closing state; a 404 from an API without the endpoint reads as
  // "not locked" — mirrors the client home screen's own lock query.
  const lockQuery = useQuery({
    queryKey: queryKeys.periodLock(period, clientId),
    queryFn: async (): Promise<PeriodLockOut> => {
      try {
        return await periodLockStatus(period, clientId);
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

  const lockMutation = useMutation({
    mutationFn: () => lockPeriod(clientId, period),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periodLock(period, clientId) });
      setConfirmingLock(false);
      setToast(`${formatPeriodLabel(period)} kapatıldı`);
    },
    onError: (error) => setToast(apiErrorMessage(error)),
  });

  // Unlike locking, the web never confirms reopening a month (Task 22's
  // AccountantMonthPage — `unlockMutation.mutate()` fires straight off the
  // click), so this mirrors that asymmetry rather than confirming both.
  const unlockMutation = useMutation({
    mutationFn: () => unlockPeriod(clientId, period),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.periodLock(period, clientId) });
      setToast(`${formatPeriodLabel(period)} yeniden açıldı`);
    },
    onError: (error) => setToast(apiErrorMessage(error)),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.clientReceipts(clientId, period) });
    queryClient.invalidateQueries({ queryKey: queryKeys.clients(period) });
  }

  const bulkMutation = useMutation({
    mutationFn: async (markAll: boolean) => {
      if (markAll) await bulkMarkProcessed(clientId, period);
      else await bulkUnmarkProcessed(clientId, period);
    },
    onSuccess: invalidate,
    onError: (error) => setToast(apiErrorMessage(error)),
  });

  const toggleMutation = useMutation({
    mutationFn: (target: ReceiptOut) =>
      target.processed ? unmarkProcessed(clientId, target.id) : markProcessed(clientId, target.id),
    onSuccess: invalidate,
    onError: (error) => setToast(apiErrorMessage(error)),
  });

  const receipts = receiptsQuery.data ?? [];
  const anyUnprocessed = receipts.some((r) => !r.processed);

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
        <Text style={[text.title, styles.title]} numberOfLines={1}>
          {clientTitle}
        </Text>
        <MonthPicker value={period} onChange={setPeriod} />
      </View>

      {company ? (
        <View style={styles.companyWrap}>
          <CompanyInfoCard
            company={company}
            expanded={companyExpanded}
            onToggle={() => setCompanyExpanded((v) => !v)}
          />
        </View>
      ) : null}

      {receiptsQuery.isLoading ? (
        <View style={styles.center}>
          <Spinner />
        </View>
      ) : null}

      {receiptsQuery.isError ? (
        <View style={styles.center}>
          <ErrorCard message={apiErrorMessage(receiptsQuery.error)} onRetry={() => receiptsQuery.refetch()} />
        </View>
      ) : null}

      {receiptsQuery.isSuccess && receipts.length === 0 ? (
        <EmptyState title="Bu ay fiş yok" description="Bu mükellef bu ay için henüz fiş yüklemedi." />
      ) : null}

      {receiptsQuery.isSuccess && receipts.length > 0 ? (
        <>
          <Text style={[text.caption, styles.hint]}>
            Tek bir fişin işlenme durumunu değiştirmek için fişe uzun basın.
          </Text>
          <FlatList
            data={receipts}
            keyExtractor={(receipt) => receipt.id}
            numColumns={2}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <ReceiptCard
                receipt={item}
                onPress={() =>
                  router.push({
                    pathname: "/(accountant)/mukellef/[clientId]/fis/[id]",
                    params: { clientId, id: item.id, period: item.period },
                  })
                }
                onLongPress={() => toggleMutation.mutate(item)}
              />
            )}
          />
        </>
      ) : null}

      {receiptsQuery.isSuccess ? (
        <View style={styles.actionBar}>
          {confirmingLock ? (
            <Card style={styles.confirmCard}>
              <Text style={[text.body, styles.confirmText]}>
                {`${formatPeriodLabel(period)} kapatılsın mı? Mükellef bu ayda fiş silemez, düzenleyemez ve `}
                {"ay değiştiremez; bu aya göndereceği yeni fişler ilk açık aya eklenir. Siz düzenlemeye "}
                {"devam edebilirsiniz ve ayı istediğiniz zaman yeniden açabilirsiniz."}
              </Text>
              <View style={styles.confirmRow}>
                <View style={styles.confirmButton}>
                  <Button title="Vazgeç" variant="secondary" onPress={() => setConfirmingLock(false)} />
                </View>
                <View style={styles.confirmButton}>
                  <Button
                    title="Ayı Kapat"
                    onPress={() => lockMutation.mutate()}
                    loading={lockMutation.isPending}
                    busyTitle="Kapatılıyor…"
                  />
                </View>
              </View>
            </Card>
          ) : null}

          {receipts.length > 0 ? (
            <Button
              title={anyUnprocessed ? "Tümünü işlendi yap" : "Tümünün işaretini kaldır"}
              onPress={() => bulkMutation.mutate(anyUnprocessed)}
              loading={bulkMutation.isPending}
              busyTitle="İşleniyor…"
            />
          ) : null}

          {monthLocked ? (
            <Button
              title="Ay kapalı — Aç"
              variant="secondary"
              onPress={() => unlockMutation.mutate()}
              loading={unlockMutation.isPending}
              busyTitle="Açılıyor…"
            />
          ) : null}

          {!monthLocked && !confirmingLock ? (
            <Button
              title="Ayı Kapat"
              variant="secondary"
              onPress={() => {
                lockMutation.reset();
                setConfirmingLock(true);
              }}
            />
          ) : null}
        </View>
      ) : null}

      <Toast message={toast} onHide={() => setToast(null)} />
    </View>
  );
}

/**
 * Collapsed by default: title + "VKN {tax_number} · {tax_office}", matching
 * the one-line summary the web packs into its header (`clientTaxLine` in
 * `AccountantMonthPage.tsx`). Expanding reveals every field from
 * `CompanyOut`, labelled with the same Turkish copy as
 * `app/(client)/firma-bilgileri.tsx`'s form — this is a mobile-only
 * affordance (the web never shows more than the one-line summary), needed
 * here because there is no desktop-width header to pack fields into.
 */
function CompanyInfoCard({
  company,
  expanded,
  onToggle,
}: {
  company: CompanyOut;
  expanded: boolean;
  onToggle: () => void;
}) {
  const title = company.trade_name ?? company.full_name;
  const taxLine = `VKN ${company.tax_number} · ${company.tax_office}`;

  return (
    <Card style={styles.companyCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? "Firma bilgilerini gizle" : "Firma bilgilerini göster"}
        onPress={onToggle}
        style={styles.companyHeader}
      >
        <View style={styles.companyHeaderText}>
          <Text style={[text.label, styles.companyTitle]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[text.caption, styles.companyTaxLine]}>{taxLine}</Text>
        </View>
        {expanded ? (
          <ChevronUp size={18} color={tokens.color.inkSoft} />
        ) : (
          <ChevronDown size={18} color={tokens.color.inkSoft} />
        )}
      </Pressable>

      {expanded ? (
        <View style={styles.companyDetails}>
          <CompanyField label="Adı Soyadı" value={company.full_name} />
          {company.trade_name ? <CompanyField label="Ticaret Ünvanı" value={company.trade_name} /> : null}
          <CompanyField label="Vergi Dairesi" value={company.tax_office} />
          <CompanyField label="Vergi Kimlik No" value={company.tax_number} />
          {company.national_id ? <CompanyField label="TC Kimlik No" value={company.national_id} /> : null}
          <CompanyField label="İş Yeri Adresi" value={company.business_address} />
          {company.tax_type ? <CompanyField label="Vergi Türü" value={company.tax_type} /> : null}
          {company.activity_name ? <CompanyField label="Faaliyet Adı" value={company.activity_name} /> : null}
          {company.activity_code ? <CompanyField label="Faaliyet Kodu" value={company.activity_code} /> : null}
          {company.started_on ? <CompanyField label="İşe Başlama Tarihi" value={company.started_on} /> : null}
        </View>
      ) : null}
    </Card>
  );
}

function CompanyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.companyField}>
      <Text style={[text.caption, styles.companyFieldLabel]}>{label}</Text>
      <Text style={[text.body, styles.companyFieldValue]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.color.page },
  center: { alignItems: "center", justifyContent: "center", padding: tokens.space(6) },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space(2),
    padding: tokens.space(3),
  },
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
  title: { flex: 1, color: tokens.color.ink },
  companyWrap: { paddingHorizontal: tokens.space(3) },
  companyCard: { padding: 0, overflow: "hidden" },
  companyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space(2),
    padding: tokens.space(3.5),
  },
  companyHeaderText: { flex: 1, gap: tokens.space(0.5) },
  companyTitle: { color: tokens.color.ink },
  companyTaxLine: { color: tokens.color.inkSoft },
  companyDetails: {
    gap: tokens.space(2.5),
    padding: tokens.space(3.5),
    paddingTop: 0,
  },
  companyField: { gap: tokens.space(0.5) },
  companyFieldLabel: { color: tokens.color.inkSoft },
  companyFieldValue: { color: tokens.color.ink },
  hint: { color: tokens.color.inkSoft, paddingHorizontal: tokens.space(3), paddingTop: tokens.space(2) },
  list: { padding: tokens.space(2), paddingBottom: tokens.space(20) },
  actionBar: {
    position: "absolute",
    left: tokens.space(3),
    right: tokens.space(3),
    bottom: tokens.space(3),
    gap: tokens.space(2),
  },
  confirmCard: { gap: tokens.space(3) },
  confirmText: { color: tokens.color.ink },
  confirmRow: { flexDirection: "row", gap: tokens.space(2.5) },
  confirmButton: { flex: 1 },
});
