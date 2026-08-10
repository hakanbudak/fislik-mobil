import { notificationText } from "../notificationText";
import type { NotificationOut } from "@/src/api/endpoints";

function makeNotification(type: string, payload: Record<string, unknown>): NotificationOut {
  return { id: "n1", type, payload, read: false, created_at: "2026-08-07T10:00:00Z" };
}

describe("notificationText", () => {
  test("invite_accepted — prefers payload.name (the normal, non-legacy shape)", () => {
    const n = makeNotification("invite_accepted", { name: "Ayşe Yıldırım", role: "accountant" });
    expect(notificationText(n)).toBe("Ayşe Yıldırım davetini kabul etti");
  });

  test("invite_accepted — falls back to payload.accountant_name (legacy key) when name is absent", () => {
    const n = makeNotification("invite_accepted", { accountant_name: "Ayşe Yıldırım" });
    expect(notificationText(n)).toBe("Ayşe Yıldırım davetini kabul etti");
  });

  test("invite_accepted — falls back to generic copy with no usable name", () => {
    const n = makeNotification("invite_accepted", {});
    expect(notificationText(n)).toBe("Karşı taraf davetini kabul etti");
  });

  test("grant_invite — accountant inviting a client", () => {
    const n = makeNotification("grant_invite", { name: "Ahmet Kaya", role: "accountant" });
    expect(notificationText(n)).toBe("Muhasebeci Ahmet Kaya sizi mükellefi olarak eklemek istiyor");
  });

  test("grant_invite — client inviting an accountant", () => {
    const n = makeNotification("grant_invite", { name: "Ahmet Kaya", role: "client" });
    expect(notificationText(n)).toBe("Ahmet Kaya, fiş ve faturalarını paylaşmak için sizi eklemek istiyor");
  });

  test("invite_declined", () => {
    const n = makeNotification("invite_declined", { name: "Ahmet Kaya" });
    expect(notificationText(n)).toBe("Ahmet Kaya davetinizi reddetti");
  });

  test("issue_opened — includes the reported message", () => {
    const n = makeNotification("issue_opened", { receipt_id: "r1", period: "2026-08", message: "Tutar okunamıyor" });
    expect(notificationText(n)).toBe("Bir fişin için sorun bildirildi: Tutar okunamıyor");
  });

  test("issue_resolved", () => {
    const n = makeNotification("issue_resolved", { receipt_id: "r1", period: "2026-08", client_id: "c1" });
    expect(notificationText(n)).toBe("Bildirdiğin sorun çözüldü");
  });

  test("receipts_submitted — client name, formatted period and count", () => {
    const n = makeNotification("receipts_submitted", {
      client_id: "c1",
      client_name: "Ayşe Yıldırım",
      period: "2026-08",
      receipt_count: 5,
    });
    expect(notificationText(n)).toBe("Ayşe Yıldırım, Ağustos 2026 fişlerini gönderdi (5 fiş)");
  });

  test("receipts_processed — accountant name, formatted period and count", () => {
    const n = makeNotification("receipts_processed", {
      period: "2026-08",
      accountant_name: "Ahmet Kaya",
      processed_count: 3,
    });
    expect(notificationText(n)).toBe("Ahmet Kaya, Ağustos 2026 fişlerinizi işledi (3 fiş)");
  });

  test("period_locked — accountant name and formatted period", () => {
    const n = makeNotification("period_locked", { period: "2026-08", accountant_name: "Ahmet Kaya" });
    expect(notificationText(n)).toBe("Ahmet Kaya, Ağustos 2026 döneminizi kapattı");
  });

  test("an unknown type falls back to readable Turkish copy, never undefined or the raw key", () => {
    const n = makeNotification("credit_granted", { amount: 10 });
    const result = notificationText(n);
    expect(result).toBe("Yeni bildirim");
    expect(result).not.toContain("undefined");
    expect(result).not.toBe("credit_granted");
  });
});
