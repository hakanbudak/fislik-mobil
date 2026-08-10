import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/src/api/client";
import { getCompany, saveCompany, type CompanyIn } from "@/src/api/endpoints";
import { queryKeys } from "@/src/api/queryKeys";
import { apiErrorMessage } from "@/src/lib/errors";
import { Button } from "@/src/theme/components/Button";
import { ErrorCard } from "@/src/theme/components/ErrorCard";
import { Input } from "@/src/theme/components/Input";
import { Spinner } from "@/src/theme/components/Spinner";
import { tokens } from "@/src/theme/tokens";
import { text } from "@/src/theme/typography";

interface FormState {
  full_name: string;
  trade_name: string;
  tax_office: string;
  tax_number: string;
  national_id: string;
  business_address: string;
  tax_type: string;
  activity_code: string;
  activity_name: string;
  started_on: string;
}

const EMPTY_FORM: FormState = {
  full_name: "",
  trade_name: "",
  tax_office: "",
  tax_number: "",
  national_id: "",
  business_address: "",
  tax_type: "",
  activity_code: "",
  activity_name: "",
  started_on: "",
};

type FormErrors = Partial<Record<keyof FormState, string>>;

// Ported verbatim from `fislik-web/src/pages/CompanyPage.tsx`'s `validate`:
// `full_name`/`tax_office`/`business_address` are required with no format
// check, `tax_number` (VKN) is required and must be exactly 10 digits,
// `national_id` (TCKN) is optional but must be exactly 11 digits when given.
function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.full_name.trim()) errors.full_name = "Zorunlu alan";
  if (!form.tax_office.trim()) errors.tax_office = "Zorunlu alan";
  if (!form.business_address.trim()) errors.business_address = "Zorunlu alan";
  if (form.tax_number.length === 0) {
    errors.tax_number = "Zorunlu alan";
  } else if (form.tax_number.length !== 10) {
    errors.tax_number = "Vergi kimlik no 10 haneli olmalı";
  }
  if (form.national_id.length > 0 && form.national_id.length !== 11) {
    errors.national_id = "TC kimlik no 11 haneli olmalı";
  }
  return errors;
}

function toPayload(form: FormState): CompanyIn {
  return {
    full_name: form.full_name.trim(),
    trade_name: form.trade_name.trim() || null,
    tax_office: form.tax_office.trim(),
    tax_number: form.tax_number,
    national_id: form.national_id || null,
    business_address: form.business_address.trim(),
    tax_type: form.tax_type.trim() || null,
    activity_code: form.activity_code.trim() || null,
    activity_name: form.activity_name.trim() || null,
    started_on: form.started_on || null,
  };
}

/**
 * "Firma Bilgileri" screen — the client's own tax-certificate (vergi
 * levhası) profile, read by their accountant when filing. Mirrors
 * `fislik-web/src/pages/CompanyPage.tsx`'s field set, validation and error
 * copy exactly (the web's onboarding "Şimdilik geç" skip step is out of
 * scope here — this screen is only ever reached from the profile screen,
 * per Task 19/20's split).
 *
 * A 404 from `GET /company` means the profile was never filled in, not an
 * error: the query resolves to `null` and the form simply renders empty,
 * same pattern as `useMe`'s 401 handling elsewhere in this app.
 */
export default function FirmaBilgileriScreen() {
  const queryClient = useQueryClient();

  const companyQuery = useQuery({
    queryKey: queryKeys.company(),
    queryFn: async () => {
      try {
        return await getCompany();
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    retry: false,
  });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  // Seeds local form state from the loaded profile exactly once — a later
  // background refetch (e.g. app refocus) must not clobber in-progress edits.
  const seededRef = useRef(false);

  useEffect(() => {
    if (!companyQuery.isSuccess || seededRef.current) return;
    seededRef.current = true;
    const data = companyQuery.data;
    if (data) {
      setForm({
        full_name: data.full_name,
        trade_name: data.trade_name ?? "",
        tax_office: data.tax_office,
        tax_number: data.tax_number,
        national_id: data.national_id ?? "",
        business_address: data.business_address,
        tax_type: data.tax_type ?? "",
        activity_code: data.activity_code ?? "",
        activity_name: data.activity_name ?? "",
        started_on: data.started_on ?? "",
      });
    }
  }, [companyQuery.isSuccess, companyQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (data: CompanyIn) => saveCompany(data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.company(), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.company() });
    },
  });

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    if (saveMutation.isSuccess) saveMutation.reset();
  }

  function handleDigitsChange(key: "tax_number" | "national_id", maxLength: number) {
    return (value: string) => updateField(key, value.replace(/\D/g, "").slice(0, maxLength));
  }

  function handleSubmit() {
    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    saveMutation.mutate(toPayload(form));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[text.title, styles.title]}>Firma Bilgileri</Text>
        <Text style={[text.caption, styles.subtitle]}>
          Vergi levhanızdaki bilgiler, muhasebeciniz tarafından görüntülenebilir.
        </Text>
      </View>

      {companyQuery.isLoading ? (
        <View style={styles.center}>
          <Spinner />
        </View>
      ) : null}

      {companyQuery.isError ? (
        <ErrorCard message={apiErrorMessage(companyQuery.error)} onRetry={() => companyQuery.refetch()} />
      ) : null}

      {!companyQuery.isLoading && !companyQuery.isError ? (
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Input
            label="Adı Soyadı"
            value={form.full_name}
            onChangeText={(v) => updateField("full_name", v)}
            error={errors.full_name}
            placeholder="Ayşe Yıldırım"
          />
          <Input
            label="Ticaret Ünvanı"
            value={form.trade_name}
            onChangeText={(v) => updateField("trade_name", v)}
            placeholder="Yıldırım Ticaret Ltd. Şti."
          />
          <Input
            label="Vergi Dairesi"
            value={form.tax_office}
            onChangeText={(v) => updateField("tax_office", v)}
            error={errors.tax_office}
            placeholder="Kadıköy"
          />
          <Input
            label="Vergi Kimlik No (10 hane)"
            value={form.tax_number}
            onChangeText={handleDigitsChange("tax_number", 10)}
            error={errors.tax_number}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="1234567890"
          />
          <Input
            label="TC Kimlik No (11 hane)"
            value={form.national_id}
            onChangeText={handleDigitsChange("national_id", 11)}
            error={errors.national_id}
            keyboardType="number-pad"
            maxLength={11}
            placeholder="12345678901"
          />
          <Input
            label="İşe Başlama Tarihi"
            value={form.started_on}
            onChangeText={(v) => updateField("started_on", v)}
            placeholder="YYYY-AA-GG"
          />
          <Input
            label="Vergi Türü"
            value={form.tax_type}
            onChangeText={(v) => updateField("tax_type", v)}
            placeholder="Gelir Vergisi"
          />
          <Input
            label="Faaliyet Kodu"
            value={form.activity_code}
            onChangeText={(v) => updateField("activity_code", v)}
            placeholder="47.11.01"
          />
          <Input
            label="Faaliyet Adı"
            value={form.activity_name}
            onChangeText={(v) => updateField("activity_name", v)}
            placeholder="Perakende gıda satışı"
          />
          <Input
            label="İş Yeri Adresi"
            value={form.business_address}
            onChangeText={(v) => updateField("business_address", v)}
            error={errors.business_address}
            placeholder="Mahalle, cadde, no, ilçe/il"
            multiline
            numberOfLines={3}
            style={styles.multiline}
          />

          {saveMutation.isError ? (
            <Text style={[text.caption, styles.error]}>{apiErrorMessage(saveMutation.error)}</Text>
          ) : null}
          {saveMutation.isSuccess ? (
            <Text style={[text.caption, styles.success]}>Firma bilgileri kaydedildi</Text>
          ) : null}

          <Button
            title="Kaydet"
            busyTitle="Kaydediliyor…"
            loading={saveMutation.isPending}
            onPress={handleSubmit}
          />
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.color.page, padding: tokens.space(3), gap: tokens.space(3) },
  header: { gap: tokens.space(1) },
  title: { color: tokens.color.ink },
  subtitle: { color: tokens.color.inkSoft },
  center: { alignItems: "center", justifyContent: "center", padding: tokens.space(6) },
  form: { gap: tokens.space(3), paddingBottom: tokens.space(8) },
  multiline: { height: 90, paddingTop: tokens.space(2.5), textAlignVertical: "top" },
  error: { color: tokens.color.danger },
  success: { color: tokens.color.success },
});
