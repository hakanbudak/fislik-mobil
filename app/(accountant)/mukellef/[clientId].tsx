import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ChevronDown, ChevronUp, Lock, LockOpen, Upload } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/src/api/client";
import {
  bulkMarkProcessed,
  bulkUnmarkProcessed,
  clientReceipts,
  getClientCompany,
  getCredits,
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
import { downloadMonthZip, SharingUnavailableError } from "@/src/features/clients/downloadMonthZip";
import { QueuedReceiptCard } from "@/src/features/receipts/QueuedReceiptCard";
import { ReceiptCard } from "@/src/features/receipts/ReceiptCard";
import { apiErrorMessage } from "@/src/lib/errors";
import { currentPeriod, formatPeriodLabel } from "@/src/lib/period";
import { Badge } from "@/src/theme/components/Badge";
import { Button } from "@/src/theme/components/Button";
import { Card } from "@/src/theme/components/Card";
import { EmptyState } from "@/src/theme/components/EmptyState";
import { ErrorCard } from "@/src/theme/components/ErrorCard";
import { MonthPicker } from "@/src/theme/components/MonthPicker";
import { Spinner } from "@/src/theme/components/Spinner";
import { Toast } from "@/src/theme/components/Toast";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";
import { useUploadQueue } from "@/src/upload/useUploadQueue";
import type { QueueRecord } from "@/src/upload/queue";

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
 *
 * Task 24 layout call, carried over from Task 22's review: this screen now
 * has three actions competing for the bottom thumb zone (mark-processed,
 * upload, close-the-month), and the first two designs would have made all
 * three visual peers in one row — an easy mis-tap between a routine action
 * and a consequential one. Resolution: month-closing is pulled OUT of the
 * bottom action bar entirely and lives in its own status row right under
 * the header (a small pill next to the month context, mirroring where the
 * web puts its lock control — right beside `MonthPicker`, not beside
 * "Fiş Yükle"/"Excel'e Aktar"). The bottom action bar is left holding only
 * the frequent, low-consequence actions — mark-all-processed, upload and
 * (Task 26) the ZIP export — grouped together as peers, with nothing
 * consequential nearby.
 *
 * Task 26's "ZIP indir · tüm ay" reuses the web's own button copy for this
 * exact action (`fislik-web/src/components/ExportModal.tsx`), rather than
 * the brief's own "Arşivi indir" — the web is the copy source of record.
 * Unlike the web, which wraps the whole multi-format "Excel'e Aktar" export
 * dialog, this screen only ever exports the ZIP (see the Task 22 brief for
 * why the export modal itself wasn't ported), so there is no format picker
 * here — the button IS the zip export.
 *
 * Mobile-fit follow-up: the floating bar used to also carry the credit
 * explanation and the credit badge/warning — up to ~250pt of overlay that
 * hid the receipt list underneath it on a phone. That copy isn't an
 * action, so it now lives in the normal scrolling content, directly after
 * the receipt list and before the bar; the bar itself holds only its three
 * buttons (bulk-mark full width, then upload/ZIP as an equal-width pair).
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

  // Not-yet-uploaded captures queued on THIS client's behalf (Task 24) —
  // scoped by clientId so a capture for a different client (or the device's
  // own, unscoped queue) never bleeds in. See `useUploadQueue`'s docstring.
  const { queued, retry: retryQueued, discard: discardQueued } = useUploadQueue(period, clientId);

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

  // The accountant's own monthly analysis-credit balance — an on-behalf
  // upload (see "Fiş Yükle" below) is paid from THIS balance, not the
  // client's, matching `fislik-web/src/pages/AccountantMonthPage.tsx`'s
  // `creditsQuery`/`["credits", "me"]`. `invalidateAfterUpload` refreshes
  // it once a queued on-behalf capture finishes uploading.
  const creditsQuery = useQuery({
    queryKey: queryKeys.credits(),
    queryFn: () => getCredits(),
    retry: false,
  });
  const credits = creditsQuery.data;

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

  // Task 26: exports the month's receipts as a ZIP and hands it to the
  // system share sheet. `downloadMonthZip` throws `ApiError(404, ...)` for
  // an empty month — that reads as an empty state, not a failure, so it
  // gets its own toast copy rather than going through `apiErrorMessage`
  // (which would show its generic 404 default, "Kayıt bulunamadı").
  // `SharingUnavailableError` is likewise not an HTTP failure and needs its
  // own branch; anything else is a genuine download failure.
  const zipMutation = useMutation({
    mutationFn: () => downloadMonthZip(clientId, period),
    onError: (error) => {
      if (error instanceof SharingUnavailableError) {
        setToast(error.message);
      } else if (error instanceof ApiError && error.status === 404) {
        setToast("Bu ay için indirilecek fiş yok");
      } else {
        setToast(apiErrorMessage(error));
      }
    },
  });

  const receipts = receiptsQuery.data ?? [];
  const anyUnprocessed = receipts.some((r) => !r.processed);

  type Row = { key: string } & (
    | { kind: "queued"; record: QueueRecord }
    | { kind: "receipt"; receipt: ReceiptOut }
  );
  const rows: Row[] = [
    ...queued.map((record) => ({ key: `q-${record.id}`, kind: "queued" as const, record })),
    ...receipts.map((receipt) => ({ key: `r-${receipt.id}`, kind: "receipt" as const, receipt })),
  ];

  function openCamera() {
    // `clientTitle`, not `fullNameParam` — the camera's on-behalf banner
    // must show the real name even when this screen only knows it via the
    // company query (deep link / cold start with no `full_name` param),
    // exactly the context-loss case the banner exists for.
    router.push({
      pathname: "/(accountant)/mukellef/[clientId]/kamera",
      params: { clientId, period, full_name: clientTitle },
    });
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
        <Text style={[text.title, styles.title]} numberOfLines={1}>
          {clientTitle}
        </Text>
        <MonthPicker value={period} onChange={setPeriod} />
      </View>

      <View style={styles.statusRow}>
        {monthLocked ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ay kapalı — tıklayıp yeniden açabilirsiniz"
            onPress={() => unlockMutation.mutate()}
            disabled={unlockMutation.isPending}
            style={[styles.lockPill, styles.lockPillWarning]}
          >
            <Lock size={12} color={tokens.color.warning} />
            <Text style={[text.caption, styles.lockPillWarningText]}>
              {unlockMutation.isPending ? "Açılıyor…" : "Ay kapalı — Aç"}
            </Text>
          </Pressable>
        ) : !confirmingLock ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ayı Kapat"
            onPress={() => {
              lockMutation.reset();
              setConfirmingLock(true);
            }}
            style={styles.lockPill}
          >
            <LockOpen size={12} color={tokens.color.inkSoft} />
            <Text style={[text.caption, styles.lockPillText]}>Ayı Kapat</Text>
          </Pressable>
        ) : null}
      </View>

      {confirmingLock ? (
        <View style={styles.confirmWrap}>
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
        </View>
      ) : null}

      {company ? (
        <View style={styles.companyWrap}>
          <CompanyInfoCard
            company={company}
            expanded={companyExpanded}
            onToggle={() => setCompanyExpanded((v) => !v)}
          />
        </View>
      ) : null}

      {receiptsQuery.isLoading && rows.length === 0 ? (
        <View style={styles.center}>
          <Spinner />
        </View>
      ) : null}

      {receiptsQuery.isError ? (
        <View style={styles.center}>
          <ErrorCard message={apiErrorMessage(receiptsQuery.error)} onRetry={() => receiptsQuery.refetch()} />
        </View>
      ) : null}

      {/*
        Queued (not-yet-uploaded) captures for this client are already on
        disk and independent of `receiptsQuery` — they must stay visible
        (and "Fiş Yükle" stay usable, below) even when the receipts fetch
        is still loading or has failed. Gating this whole block on
        `receiptsQuery.isSuccess` would make an accountant's own just-shot
        captures disappear the moment the network hiccups, which reads as
        data loss even though nothing was actually lost.
      */}
      {!receiptsQuery.isLoading && !receiptsQuery.isError && rows.length === 0 ? (
        <EmptyState title="Bu ay fiş yok" description="Bu mükellef bu ay için henüz fiş yüklemedi." />
      ) : null}

      {rows.length > 0 ? (
        <>
          {receipts.length > 0 ? (
            <Text style={[text.caption, styles.hint]}>
              Tek bir fişin işlenme durumunu değiştirmek için fişe uzun basın.
            </Text>
          ) : null}
          <FlatList
            data={rows}
            keyExtractor={(row) => row.key}
            numColumns={2}
            contentContainerStyle={styles.list}
            renderItem={({ item }) =>
              item.kind === "queued" ? (
                <QueuedReceiptCard
                  record={item.record}
                  onRetry={() => retryQueued(item.record.id)}
                  onDiscard={() => discardQueued(item.record.id)}
                />
              ) : (
                <ReceiptCard
                  receipt={item.receipt}
                  onPress={() =>
                    router.push({
                      pathname: "/(accountant)/mukellef/[clientId]/fis/[id]",
                      params: { clientId, id: item.receipt.id, period: item.receipt.period },
                    })
                  }
                  onLongPress={() => toggleMutation.mutate(item.receipt)}
                />
              )
            }
          />
        </>
      ) : null}

      {/*
        Information about the upload action's cost, not an action itself —
        moved out of `actionBar` (Task: mobile-fit) into the page's normal
        scrolling content, directly after the receipt list and before the
        bar, so it reads as the upload button's consequence without
        floating on top of the receipts. Rendered unconditionally on
        `rows.length` (matching the old bar's own unconditional credit
        note) since "Fiş Yükle" is available whether or not this month has
        receipts yet.
      */}
      <View style={styles.creditInfo}>
        <Text style={[text.caption, styles.creditNote]}>
          Muhasebeci olarak yüklediğiniz fişler bu mükellefin ayına eklenir ve analiz kredisi sizin
          hesabınızdan düşülür.
        </Text>
        {credits && !credits.unlimited ? (
          <View style={styles.creditRow}>
            <Badge label={`Bu ay ${credits.used}/${credits.limit ?? 0} analiz`} tone="neutral" />
          </View>
        ) : null}
        {credits && !credits.unlimited && credits.remaining === 0 ? (
          <Text style={[text.caption, styles.creditWarning]}>
            Aylık analiz limitiniz doldu — yüklediğiniz fişler sıraya alınır, kredi yenilenince analiz
            edilir.
          </Text>
        ) : null}
      </View>

      {/*
        Actions only (Task: mobile-fit) — the credit note/badge used to live
        here too, which made this overlay ~250pt tall and hid the receipt
        list underneath it. Row 1 is the (conditional) bulk-mark action,
        full width; row 2 is upload + ZIP export as equal-width peers,
        matching the module docstring's Task 24/26 grouping rationale.
      */}
      <View style={styles.actionBar} testID="action-bar">
        {receipts.length > 0 ? (
          <Button
            title={anyUnprocessed ? "Tümünü işlendi yap" : "Tümünün işaretini kaldır"}
            onPress={() => bulkMutation.mutate(anyUnprocessed)}
            loading={bulkMutation.isPending}
            busyTitle="İşleniyor…"
          />
        ) : null}

        <View style={styles.actionRow}>
          <View style={styles.actionRowButton}>
            <Button title="Fiş Yükle" variant="secondary" onPress={openCamera} />
          </View>
          <View style={styles.actionRowButton}>
            <Button
              title="ZIP indir · tüm ay"
              variant="secondary"
              onPress={() => zipMutation.mutate()}
              loading={zipMutation.isPending}
              busyTitle="İndiriliyor…"
            />
          </View>
        </View>
      </View>

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
    paddingBottom: 0,
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
  // A separate row under the header, deliberately away from the bottom
  // action bar's routine actions — see the module docstring's Task 24 note.
  statusRow: {
    flexDirection: "row",
    paddingHorizontal: tokens.space(3),
    paddingTop: tokens.space(2),
  },
  lockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space(1.5),
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.card,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space(2.5),
    paddingVertical: tokens.space(1.5),
  },
  lockPillText: { color: tokens.color.inkSoft },
  lockPillWarning: { borderColor: tokens.color.warning },
  lockPillWarningText: { color: tokens.color.warning },
  confirmWrap: { paddingHorizontal: tokens.space(3), paddingTop: tokens.space(2) },
  companyWrap: { paddingHorizontal: tokens.space(3), paddingTop: tokens.space(2) },
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
  // Bottom padding sized to clear the now two-row (was up to five-element)
  // floating bar — see `actionBar` below for why it no longer needs ~250pt.
  list: { padding: tokens.space(2), paddingBottom: tokens.space(20) },
  creditInfo: {
    paddingHorizontal: tokens.space(3),
    paddingTop: tokens.space(2),
    gap: tokens.space(2),
  },
  actionBar: {
    position: "absolute",
    left: tokens.space(3),
    right: tokens.space(3),
    // No `insets.bottom` added here (verified, not assumed): this screen is
    // one of the accountant tab navigator's own screens (see the module
    // docstring — `mukellef/[clientId]` is hoisted straight into
    // `(accountant)/_layout.tsx`'s `<Tabs>` with `href: null`, not pushed
    // as a separate stack screen over it), so the always-on tab bar stays
    // mounted underneath and this screen's content area is sized to the
    // space ABOVE it, not down to the physical screen edge. The tab bar
    // itself already pads for `insets.bottom` (`paddingBottom:
    // tokens.space(2.5) + insets.bottom`, `_layout.tsx`), so this bar's
    // fixed offset already clears the home indicator without adding the
    // inset a second time — doing so would just waste vertical space above
    // the tab bar.
    bottom: tokens.space(3),
    gap: tokens.space(2),
  },
  actionRow: { flexDirection: "row", gap: tokens.space(2) },
  actionRowButton: { flex: 1 },
  confirmCard: { gap: tokens.space(3) },
  confirmText: { color: tokens.color.ink },
  confirmRow: { flexDirection: "row", gap: tokens.space(2.5) },
  confirmButton: { flex: 1 },
  creditNote: { color: tokens.color.inkSoft },
  creditRow: { flexDirection: "row", gap: tokens.space(1.5) },
  creditWarning: { color: tokens.color.warning },
});
