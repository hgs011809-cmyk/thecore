/**
 * 기기 보안저장소 래퍼.
 * - 신원 개인키 / auth_token 은 Keychain(iOS) · Keystore(안드로이드)에 저장.
 * - 아이디·공개키 등 비밀이 아닌 값은 AsyncStorage.
 */
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SECRET_SERVICE = 'secretcall.secret'; // secretKey + authToken 묶음
const KEY_USER_ID = 'secretcall.userId';
const KEY_PUBLIC = 'secretcall.publicKey';

export interface Secrets {
  secretKey: string; // Ed25519 개인키 (base64)
  authToken: string; // 서버 접속 토큰
}

export async function saveSession(params: {
  userId: string;
  publicKey: string;
  secretKey: string;
  authToken: string;
}): Promise<void> {
  await Keychain.setGenericPassword(
    'secretcall',
    JSON.stringify({ secretKey: params.secretKey, authToken: params.authToken }),
    { service: SECRET_SERVICE, accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED }
  );
  await AsyncStorage.multiSet([
    [KEY_USER_ID, params.userId],
    [KEY_PUBLIC, params.publicKey],
  ]);
}

export async function loadSecrets(): Promise<Secrets | null> {
  const creds = await Keychain.getGenericPassword({ service: SECRET_SERVICE });
  if (!creds) return null;
  try {
    return JSON.parse(creds.password) as Secrets;
  } catch {
    return null;
  }
}

export async function loadPublicInfo(): Promise<{ userId: string; publicKey: string } | null> {
  const [[, userId], [, publicKey]] = await AsyncStorage.multiGet([KEY_USER_ID, KEY_PUBLIC]);
  if (!userId || !publicKey) return null;
  return { userId, publicKey };
}

export async function isRegistered(): Promise<boolean> {
  return (await loadPublicInfo()) !== null && (await loadSecrets()) !== null;
}

export async function clearSession(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SECRET_SERVICE });
  await AsyncStorage.multiRemove([KEY_USER_ID, KEY_PUBLIC]);
}
