import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ExtractionOut, ExtractionPatchIn } from "@/src/api/endpoints";
import type { components } from "@/src/api/generated/schema";
import { apiErrorMessage } from "@/src/lib/errors";
import { CATEGORY_LABELS, DOC_TYPE_LABELS, PAYMENT_LABELS, fmtNum, parseAmountInput } from "@/src/lib/receiptReview";
import { Button } from "@/src/theme/components/Button";
import { Card } from "@/src/theme/components/Card";
import { Input } from "@/src/theme/components/Input";
import { Spinner } from "@/src/theme/components/Spinner";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

/**
 * The literal doc-type/payment/category/tax-id-type unions, derived off the
 * generated schema the same way `src/lib/receiptReview.ts` does — this file
 * never hand-duplicates the API's enum values or their Turkish labels
 * (`DOC_TYPE_LABELS`/`PAYMENT_LABELS`/`CATEGORY_LABELS` all come from Task 15).
 */
type DocType = NonNullable<components["schemas"]["ExtractionPatchIn"]["doc_type"]>;
type PaymentMethod = NonNullable<components["schemas"]["ExtractionPatchIn"]["payment_method"]>;
type ExpenseCategory = NonNullable<components["schemas"]["ExtractionPatchIn"]["expense_category"]>;
type TaxIdType = NonNullable<components["schemas"]["ExtractionPatchIn"]["merchant_tax_id_type"]>;

/** Not part of `receiptReview.ts` — VKN/TCKN are official abbreviations, not
 *  a second copy of a Turkish label set that exists anywhere else. */
const TAX_ID_TYPE_LABELS: Record<TaxIdType, string> = { vkn: "VKN", tckn: "TCKN" };

const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS) as ExpenseCategory[];

function asDocType(v: string | null): DocType {
  return v === "fis" || v === "fatura" ? v : "unknown";
}
function asPaymentMethod(v: string | null): PaymentMethod {
  return v === "nakit" || v === "kredi_karti" ? v : "bilinmiyor";
}
function asTaxIdType(v: string | null): TaxIdType {
  return v === "tckn" ? "tckn" : "vkn";
}
function asExpenseCategory(v: string | null): ExpenseCategory {
  return (CATEGORY_KEYS as string[]).includes(v ?? "") ? (v as ExpenseCategory) : "diger";
}

/** True ISO "YYYY-MM-DD" *and* a real calendar date — rejects both malformed
 *  shapes ("05.08.2026") and out-of-range dates ("2026-02-31"), which
 *  `Date`'s lenient parser would otherwise silently roll over into March. */
function isValidIsoDate(v: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Two amounts are "the same" if their numeric value matches, regardless of
 * how many decimals either string spells out. `buildDraft` round-trips every
 * amount through `fmtNum` (always two decimals) and `computeChanges` parses
 * it back via `parseAmountInput` (which does NOT re-pad/truncate decimals),
 * so an untouched field whose API value has a different decimal count (e.g.
 * `"218.4"`) would otherwise come back as `"218.40"` and read as changed.
 */
function amountUnchanged(parsed: string | null, original: string | null): boolean {
  if (parsed === original) return true;
  if (parsed === null || original === null) return false;
  return Number(parsed) === Number(original);
}

interface Draft {
  merchant: string;
  date: string;
  no: string;
  docType: DocType;
  taxType: TaxIdType;
  taxId: string;
  office: string;
  pay: PaymentMethod;
  category: ExpenseCategory;
  total: string;
  vat: string;
}

function buildDraft(extraction: ExtractionOut | null): Draft {
  return {
    merchant: extraction?.merchant_name ?? "",
    date: extraction?.receipt_date ?? "",
    no: extraction?.receipt_number ?? "",
    docType: asDocType(extraction?.doc_type ?? null),
    taxType: asTaxIdType(extraction?.merchant_tax_id_type ?? null),
    taxId: extraction?.merchant_tax_id ?? "",
    office: extraction?.merchant_tax_office ?? "",
    pay: asPaymentMethod(extraction?.payment_method ?? null),
    category: asExpenseCategory(extraction?.expense_category ?? null),
    total: fmtNum(extraction?.total_amount ? Number(extraction.total_amount) : null),
    vat: fmtNum(extraction?.vat_total ? Number(extraction.vat_total) : null),
  };
}

interface ComputeResult {
  /** Only ever non-empty when `amountError`/`dateError`/`taxIdError` are all
   *  null — an invalid field aborts the whole save rather than patching
   *  around it, since the API has no partial-validation story. */
  patch: ExtractionPatchIn;
  amountError: string | null;
  dateError: string | null;
  taxIdError: string | null;
}

/**
 * Diffs `draft` against the extraction it was seeded from and returns only
 * the changed fields — sending unchanged fields back is not just wasted
 * bandwidth: the API's PATCH unconditionally stamps the receipt `status:
 * "done"`, clears its error, and sets `edited_by`/`edited_at`, regardless of
 * what the body contains. On a `pending`/`failed` receipt that silently and
 * permanently cancels the AI extraction (`retry_extraction` refuses with 409
 * once `edited_by` is set), so an accidental or false-positive diff is not a
 * cosmetic bug — it is unrecoverable for that receipt. `vat_breakdown` is
 * read-only here (see the module docstring) and is therefore never part of
 * the diff.
 *
 * Amounts go through `parseAmountInput`: `undefined` means unparseable and
 * aborts the whole save; `null` means the field was cleared and is a
 * legitimate diff value. `amountUnchanged` guards the comparison against
 * `parseAmountInput`'s decimal-count round-trip (see its docstring).
 */
function computeChanges(extraction: ExtractionOut, draft: Draft): ComputeResult {
  const total = parseAmountInput(draft.total);
  const vat = parseAmountInput(draft.vat);
  const amountError = total === undefined || vat === undefined ? "Geçerli bir tutar girin" : null;

  const dateTrimmed = draft.date.trim();
  const dateError =
    dateTrimmed !== "" && !isValidIsoDate(dateTrimmed) ? "Geçerli bir tarih girin (YYYY-AA-GG)" : null;

  const taxId = draft.taxId.trim();
  const taxIdDigits = draft.taxType === "tckn" ? 11 : 10;
  const taxIdError =
    taxId !== "" && !new RegExp(`^\\d{${taxIdDigits}}$`).test(taxId)
      ? `${draft.taxType === "tckn" ? "TCKN" : "VKN"} ${taxIdDigits} haneli olmalı`
      : null;

  if (amountError || dateError || taxIdError) {
    return { patch: {}, amountError, dateError, taxIdError };
  }

  const patch: ExtractionPatchIn = {};

  const merchant = draft.merchant.trim() === "" ? null : draft.merchant.trim();
  if (merchant !== (extraction.merchant_name ?? null)) patch.merchant_name = merchant;

  const date = dateTrimmed === "" ? null : dateTrimmed;
  if (date !== (extraction.receipt_date ?? null)) patch.receipt_date = date;

  if (!amountUnchanged(total as string | null, extraction.total_amount ?? null)) patch.total_amount = total;
  if (!amountUnchanged(vat as string | null, extraction.vat_total ?? null)) patch.vat_total = vat;

  if (draft.docType !== asDocType(extraction.doc_type)) patch.doc_type = draft.docType;

  const taxIdValue = taxId === "" ? null : taxId;
  const taxTypeValue = taxId === "" ? null : draft.taxType;
  // Normalize BOTH sides through `asTaxIdType` — comparing draft.taxType
  // (already normalized by `buildDraft`) against the raw API value would
  // report a spurious diff whenever the AI found a tax id but left its type
  // null, since `asTaxIdType(null)` defaults to `"vkn"` for display.
  const originalTaxId = extraction.merchant_tax_id ?? null;
  const originalTaxType = originalTaxId ? asTaxIdType(extraction.merchant_tax_id_type) : null;
  if (taxIdValue !== originalTaxId) patch.merchant_tax_id = taxIdValue;
  if (taxTypeValue !== originalTaxType) patch.merchant_tax_id_type = taxTypeValue;

  const office = draft.office.trim() === "" ? null : draft.office.trim();
  if (office !== (extraction.merchant_tax_office ?? null)) patch.merchant_tax_office = office;

  const no = draft.no.trim() === "" ? null : draft.no.trim();
  if (no !== (extraction.receipt_number ?? null)) patch.receipt_number = no;

  if (draft.pay !== asPaymentMethod(extraction.payment_method)) patch.payment_method = draft.pay;
  if (draft.category !== asExpenseCategory(extraction.expense_category)) patch.expense_category = draft.category;

  return { patch, amountError: null, dateError: null, taxIdError: null };
}

/** A row of always-visible pill options — used for the three- (or two-)
 *  valued fields (`Belge türü`, `Ödeme`, tax-id type) where every choice
 *  fits on screen at once. */
function SegmentedField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[text.caption, styles.fieldLabel]}>{label}</Text>
      <View style={styles.segmentRow}>
        {options.map(([optValue, optLabel]) => {
          const active = optValue === value;
          return (
            <Pressable
              key={optValue}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled }}
              disabled={disabled}
              onPress={() => onChange(optValue)}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Text style={[text.caption, active ? styles.segmentTextActive : styles.segmentText]}>{optLabel}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * `Kategori` gets its own control instead of `SegmentedField`: ten pills
 * would either wrap across four cramped rows or force horizontal scrolling,
 * neither of which reads well as a one-handed phone control. This renders as
 * a single tappable row showing the current category, which expands into a
 * plain in-place list of the ten `CATEGORY_LABELS` options — no native
 * picker/modal dependency is in this project yet, so a modal sheet wasn't
 * an option without adding one.
 */
function CategoryField({
  value,
  onChange,
  disabled,
}: {
  value: ExpenseCategory;
  onChange: (next: ExpenseCategory) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const expanded = open && !disabled;
  return (
    <View style={styles.fieldWrap}>
      <Text style={[text.caption, styles.fieldLabel]}>Kategori</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kategori"
        accessibilityState={{ expanded, disabled }}
        disabled={disabled}
        onPress={() => setOpen((prev) => !prev)}
        style={styles.pickerHeader}
      >
        <Text style={[text.body, styles.pickerValue]}>{CATEGORY_LABELS[value]}</Text>
        {expanded ? (
          <ChevronUp size={16} color={tokens.color.inkSoft} />
        ) : (
          <ChevronDown size={16} color={tokens.color.inkSoft} />
        )}
      </Pressable>
      {expanded ? (
        <View style={styles.pickerList}>
          {CATEGORY_KEYS.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => {
                onChange(key);
                setOpen(false);
              }}
              style={styles.pickerOption}
            >
              <Text style={[text.body, key === value ? styles.pickerOptionActive : styles.pickerOptionText]}>
                {CATEGORY_LABELS[key]}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ExtractionEditor({
  extraction,
  onSave,
  onRetry,
  readOnly = false,
}: {
  extraction: ExtractionOut | null;
  onSave: (patch: ExtractionPatchIn) => void | Promise<void>;
  onRetry: () => void;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(() => buildDraft(extraction));
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [taxIdError, setTaxIdError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  // A no-op PATCH is not merely wasteful — the API unconditionally stamps
  // the receipt `edited` and flips a pending/failed extraction to `done`
  // regardless of body contents (see `computeChanges`'s docstring), so
  // Kaydet must be unreachable whenever nothing has actually changed. An
  // active validation error still counts as "changed": the only way a field
  // seeded from `buildDraft` can be invalid is if the user edited it away
  // from the always-valid value the API returned.
  const preview =
    extraction && extraction.status !== "pending" ? computeChanges(extraction, draft) : null;
  const hasChanges =
    !!preview &&
    (Object.keys(preview.patch).length > 0 || !!preview.amountError || !!preview.dateError || !!preview.taxIdError);

  async function handleSave() {
    if (!extraction) return;
    const result = computeChanges(extraction, draft);
    setAmountError(result.amountError);
    setDateError(result.dateError);
    setTaxIdError(result.taxIdError);
    if (result.amountError || result.dateError || result.taxIdError) return;
    if (Object.keys(result.patch).length === 0) return;
    setSaveError(null);
    setSaving(true);
    try {
      await onSave(result.patch);
    } catch (err) {
      setSaveError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (extraction === null) {
    return (
      <Card>
        <Text style={[text.body, styles.notice]}>
          Bu ayın analiz hakkı doldu. Fiş sıraya alındı, gelecek ay analiz edilecek.
        </Text>
      </Card>
    );
  }

  if (extraction.status === "pending") {
    return (
      <Card>
        <Spinner />
        <Text style={[text.body, styles.notice]}>Fiş bilgileri çıkarılıyor…</Text>
      </Card>
    );
  }

  const disabled = readOnly;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {extraction.status === "failed" ? (
        <Card style={styles.failedCard}>
          <Text style={[text.body, styles.failedText]}>Fiş bilgileri okunamadı, elle girebilirsiniz.</Text>
          <Button title="Yeniden dene" variant="secondary" onPress={onRetry} />
        </Card>
      ) : null}

      <Card style={styles.section}>
        <Text style={[text.label, styles.sectionTitle]}>Satıcı</Text>
        <Input
          label="Satıcı"
          value={draft.merchant}
          editable={!disabled}
          maxLength={256}
          onChangeText={(v) => set("merchant", v)}
        />
        <View style={styles.row}>
          <View style={styles.rowItemSmall}>
            <SegmentedField<TaxIdType>
              label="Kimlik türü"
              value={draft.taxType}
              options={Object.entries(TAX_ID_TYPE_LABELS) as [TaxIdType, string][]}
              onChange={(v) => set("taxType", v)}
              disabled={disabled}
            />
          </View>
          <View style={styles.rowItem}>
            <Input
              label="VKN/TCKN"
              value={draft.taxId}
              editable={!disabled}
              keyboardType="number-pad"
              maxLength={11}
              error={taxIdError ?? undefined}
              onChangeText={(v) => set("taxId", v)}
            />
          </View>
        </View>
        <Input
          label="Vergi dairesi"
          value={draft.office}
          editable={!disabled}
          maxLength={120}
          onChangeText={(v) => set("office", v)}
        />
      </Card>

      <Card style={styles.section}>
        <Text style={[text.label, styles.sectionTitle]}>Fiş bilgileri</Text>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Input
              label="Tarih"
              value={draft.date}
              editable={!disabled}
              error={dateError ?? undefined}
              onChangeText={(v) => set("date", v)}
            />
          </View>
          <View style={styles.rowItem}>
            <Input
              label="Fiş no"
              value={draft.no}
              editable={!disabled}
              maxLength={64}
              onChangeText={(v) => set("no", v)}
            />
          </View>
        </View>
        <SegmentedField<DocType>
          label="Belge türü"
          value={draft.docType}
          options={Object.entries(DOC_TYPE_LABELS) as [DocType, string][]}
          onChange={(v) => set("docType", v)}
          disabled={disabled}
        />
      </Card>

      <Card style={styles.section}>
        <Text style={[text.label, styles.sectionTitle]}>Tutar</Text>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Input
              label="Toplam"
              value={draft.total}
              editable={!disabled}
              keyboardType="decimal-pad"
              placeholder="0,00"
              onChangeText={(v) => set("total", v)}
            />
          </View>
          <View style={styles.rowItem}>
            <Input
              label="KDV"
              value={draft.vat}
              editable={!disabled}
              keyboardType="decimal-pad"
              placeholder="0,00"
              onChangeText={(v) => set("vat", v)}
            />
          </View>
        </View>
        {extraction.vat_breakdown.length > 0 ? (
          <View style={styles.vatRows}>
            <Text style={[text.caption, styles.fieldLabel]}>KDV dökümü</Text>
            {extraction.vat_breakdown.map((line, index) => (
              <Text key={index} style={[text.body, styles.vatRow]}>
                {`%${line.rate} · ${fmtNum(Number(line.amount))} ₺`}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>

      <Card style={styles.section}>
        <Text style={[text.label, styles.sectionTitle]}>Sınıflandırma</Text>
        <SegmentedField<PaymentMethod>
          label="Ödeme"
          value={draft.pay}
          options={Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][]}
          onChange={(v) => set("pay", v)}
          disabled={disabled}
        />
        <CategoryField value={draft.category} onChange={(v) => set("category", v)} disabled={disabled} />
      </Card>

      {amountError || saveError ? (
        <Text style={[text.caption, styles.error]}>{amountError ?? saveError}</Text>
      ) : null}

      {!readOnly ? (
        <Button title="Kaydet" onPress={handleSave} loading={saving} disabled={!hasChanges} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: tokens.space(3), paddingBottom: tokens.space(6) },
  notice: { color: tokens.color.inkSoft, textAlign: "center" },
  failedCard: { gap: tokens.space(2), alignItems: "flex-start" },
  failedText: { color: tokens.color.warning },
  section: { gap: tokens.space(3) },
  sectionTitle: { color: tokens.color.inkSoft },
  row: { flexDirection: "row", gap: tokens.space(3) },
  rowItem: { flex: 1 },
  rowItemSmall: { width: 108 },
  fieldWrap: { gap: tokens.space(1.5) },
  fieldLabel: { color: tokens.color.inkSoft },
  segmentRow: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space(1.5) },
  segment: {
    paddingHorizontal: tokens.space(3),
    paddingVertical: tokens.space(1.5),
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.card,
  },
  segmentActive: { backgroundColor: tokens.color.primary, borderColor: tokens.color.primary },
  segmentText: { color: tokens.color.ink },
  segmentTextActive: { color: tokens.color.onPrimary },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 46,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.card,
    paddingHorizontal: tokens.space(3),
  },
  pickerValue: { color: tokens.color.ink },
  pickerList: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.card,
    overflow: "hidden",
  },
  pickerOption: { paddingHorizontal: tokens.space(3), paddingVertical: tokens.space(2.5) },
  pickerOptionText: { color: tokens.color.ink },
  pickerOptionActive: { color: tokens.color.primary, fontFamily: text.label.fontFamily },
  vatRows: { gap: tokens.space(1) },
  vatRow: { color: tokens.color.ink },
  error: { color: tokens.color.danger },
});
