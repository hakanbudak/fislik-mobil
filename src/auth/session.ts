import * as SecureStore from "expo-secure-store";
import { setTokenProvider } from "@/src/api/client";

const KEY = "fislik.access_token";

/** Mirrored in memory because apiFetch needs the token synchronously on every
 *  request, while SecureStore is async. */
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
  token = value;
  await SecureStore.setItemAsync(KEY, value);
}

export async function clearSession(): Promise<void> {
  token = null;
  await SecureStore.deleteItemAsync(KEY);
}
