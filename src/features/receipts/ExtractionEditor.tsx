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

/**
 * Diffs `draft` against the extraction it was seeded from and returns only
 * the changed fields — sending unchanged fields back would make the API
 * stamp the receipt `edited` even though the accountant/client touched
 * nothing. `vat_breakdown` is read-only here (see the module docstring) and
 * is therefore never part of the diff.
 *
 * Amounts go through `parseAmountInput`: `undefined` means unparseable and
 * aborts the whole save (returned as `error`); `null` means the field was
 * cleared and is a legitimate diff value.
 */
function computeChanges(extraction: ExtractionOut, draft: Draft): { patch: ExtractionPatchIn; error: string | null } {
  const total = parseAmountInput(draft.total);
  const vat = parseAmountInput(draft.vat);
  if (total === undefined || vat === undefined) {
    return { patch: {}, error: "Geçerli bir tutar girin" };
  }

  const patch: ExtractionPatchIn = {};

  const merchant = draft.merchant.trim() === "" ? null : draft.merchant.trim();
  if (merchant !== (extraction.merchant_name ?? null)) patch.merchant_name = merchant;

  const date = draft.date.trim() === "" ? null : draft.date.trim();
  if (date !== (extraction.receipt_date ?? null)) patch.receipt_date = date;

  if (total !== (extraction.total_amount ?? null)) patch.total_amount = total;
  if (vat !== (extraction.vat_total ?? null)) patch.vat_total = vat;

  if (draft.docType !== asDocType(extraction.doc_type)) patch.doc_type = draft.docType;

  const taxId = draft.taxId.trim();
  const taxIdValue = taxId === "" ? null : taxId;
  const taxTypeValue = taxId === "" ? null : draft.taxType;
  if (taxIdValue !== (extraction.merchant_tax_id ?? null)) patch.merchant_tax_id = taxIdValue;
  if (taxTypeValue !== (extraction.merchant_tax_id_type ?? null)) patch.merchant_tax_id_type = taxTypeValue;

  const office = draft.office.trim() === "" ? null : draft.office.trim();
  if (office !== (extraction.merchant_tax_office ?? null)) patch.merchant_tax_office = office;

  const no = draft.no.trim() === "" ? null : draft.no.trim();
  if (no !== (extraction.receipt_number ?? null)) patch.receipt_number = no;

  if (draft.pay !== asPaymentMethod(extraction.payment_method)) patch.payment_method = draft.pay;
  if (draft.category !== asExpenseCategory(extraction.expense_category)) patch.expense_category = draft.category;

  return { patch, error: null };
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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!extraction) return;
    const { patch, error } = computeChanges(extraction, draft);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    setSaveError(null);
    setSaving(true);
    try {
      await onSave(patch);
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
            <Input label="Tarih" value={draft.date} editable={!disabled} onChangeText={(v) => set("date", v)} />
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

      {validationError || saveError ? (
        <Text style={[text.caption, styles.error]}>{validationError ?? saveError}</Text>
      ) : null}

      {!readOnly ? (
        <Button title="Kaydet" onPress={handleSave} loading={saving} />
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
