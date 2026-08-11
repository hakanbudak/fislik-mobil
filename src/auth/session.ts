import * as SecureStore from "expo-secure-store";
import { setTokenProvider } from "@/src/api/client";

const KEY = "fislik.access_token";

/** Mirrored in memory because apiFetch needs the token synchronously on every
 *  request, while SecureStore is async. Storage is updated FIRST in saveSession
 *  and clearSession so that if either rejects, memory stays in sync with disk
 *  and the error propagates to the caller. */
let token: string | null = null;

setTokenProvider(() => token);

export function currentToken(): string | null {
  return token;
}

export async function loadSession(): Promise<string | null> {
  token = await SecureStore.getItemAsync(KEY);
  return token;
}

export async function saveSession(value: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, value);
  token = value;
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
  token = null;
}
