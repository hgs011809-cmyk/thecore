/** 서버 REST API 클라이언트. */
import { API_BASE } from '../config';

export interface RegisterResult {
  user_id: string;
  auth_token: string;
  ice_servers: RTCIceServerLike[];
}

export interface RTCIceServerLike {
  urls: string | string[];
  username?: string;
  credential?: string;
}

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `요청 실패 (${res.status})`);
  }
  return data as T;
}

/** 가입: 등록코드 + 공개키 → auth_token */
export async function register(params: {
  userId: string;
  registrationCode: string;
  publicKey: string;
}): Promise<RegisterResult> {
  const res = await fetch(`${API_BASE}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      user_id: params.userId,
      registration_code: params.registrationCode,
      identity_public_key: params.publicKey,
    }),
  });
  return json<RegisterResult>(res);
}

function authHeaders(userId: string, authToken: string) {
  return { 'x-user-id': userId, 'x-auth-token': authToken };
}

/** 최신 ICE 서버 설정 */
export async function fetchIceServers(
  userId: string,
  authToken: string
): Promise<RTCIceServerLike[]> {
  const res = await fetch(`${API_BASE}/api/ice`, { headers: authHeaders(userId, authToken) });
  const data = await json<{ ice_servers: RTCIceServerLike[] }>(res);
  return data.ice_servers;
}

/** 수신 알림용 기기 푸시 토큰 등록 */
export async function registerPushToken(
  userId: string,
  authToken: string,
  platform: 'android' | 'ios',
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/push-token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(userId, authToken) },
    body: JSON.stringify({ platform, token }),
  });
  await json<{ ok: boolean }>(res);
}

/** 상대 신원 공개키 조회 (안전번호 계산용) */
export async function fetchPeerPublicKey(
  userId: string,
  authToken: string,
  peerId: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(peerId)}/pubkey`, {
    headers: authHeaders(userId, authToken),
  });
  const data = await json<{ identity_public_key: string }>(res);
  return data.identity_public_key;
}
