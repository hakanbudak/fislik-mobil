import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

const KEY = "fislik.biometric_enabled";

export async function isBiometricAvailable(): Promise<boolean> {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === "1";
}

export async function setBiometricEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, on ? "1" : "0");
}

/** Gates app launch when the user opted in. Returns true whenever there is
 *  nothing to check — the feature is a convenience lock on an already-valid
 *  session, never the thing that authorises access to the API. A device
 *  that has lost its enrolled biometrics (removed fingerprints, restored
 *  without Face ID set up) must not permanently strand a user whose token
 *  is still perfectly valid, so that case also unlocks. */
export async function requestUnlock(): Promise<boolean> {
  if (!(await isBiometricEnabled())) return true;
  if (!(await isBiometricAvailable())) return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Fişlik'i aç",
    cancelLabel: "İptal",
    fallbackLabel: "Şifreyle gir",
  });
  return result.success;
}
