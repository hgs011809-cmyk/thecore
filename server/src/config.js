import 'dotenv/config';
import path from 'node:path';
import { makeTurnCredential } from './turn.js';

function required(name) {
  const v = process.env[name];
  if (!v || v.trim() === '' || v === 'change-me-to-a-long-random-string') {
    throw new Error(
      `환경변수 ${name} 가 설정되지 않았습니다. .env 파일을 확인하세요 (.env.example 참고).`
    );
  }
  return v;
}

function splitUrls(v) {
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT || 8080),
  adminKey: required('ADMIN_KEY'),
  dbPath: path.resolve(process.env.DB_PATH || './data/secretcall.db'),
  registrationCodeBytes: Number(process.env.REGISTRATION_CODE_BYTES || 6),
  authTokenBytes: Number(process.env.AUTH_TOKEN_BYTES || 32),
  ice: {
    stunUrls: splitUrls(process.env.STUN_URLS || 'stun:stun.l.google.com:19302'),
    turnUrls: splitUrls(process.env.TURN_URLS),
    // 방식 A(권장): 시간제한 임시 자격증명 — coturn 과 공유하는 비밀
    turnSecret: process.env.TURN_STATIC_SECRET || '',
    turnTtlSeconds: Number(process.env.TURN_TTL_SECONDS || 600),
    // 방식 B(대체): 고정 자격증명
    turnUsername: process.env.TURN_USERNAME || '',
    turnCredential: process.env.TURN_CREDENTIAL || '',
  },
  // 오프라인 상대에게 보낼 통화 offer 버퍼 유지 시간(ms)
  pendingCallTtlMs: Number(process.env.PENDING_CALL_TTL_MS || 45_000),
  // 테스트용 미리 심을 계정. "id:code,id2:code2" 형식.
  // 무료 PaaS(재시작 시 저장소 초기화)에서 테스트 계정이 항상 존재하도록.
  seedUsers: (process.env.SEED_USERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf(':');
      return i > 0
        ? { user_id: pair.slice(0, i).trim(), registration_code: pair.slice(i + 1).trim() }
        : null;
    })
    .filter((x) => x && x.user_id && x.registration_code),
  push: {
    // Android: FCM HTTP v1
    fcm: {
      projectId: process.env.FCM_PROJECT_ID || '',
      serviceAccountFile: process.env.FCM_SERVICE_ACCOUNT_FILE || '',
    },
    // iOS: APNs VoIP 푸시 (PushKit)
    apns: {
      keyFile: process.env.APNS_KEY_FILE || '', // .p8
      keyId: process.env.APNS_KEY_ID || '',
      teamId: process.env.APNS_TEAM_ID || '',
      bundleId: process.env.APNS_BUNDLE_ID || '',
      production: (process.env.APNS_PRODUCTION || 'false') === 'true',
    },
  },
};

export const fcmEnabled = () =>
  !!(config.push.fcm.projectId && config.push.fcm.serviceAccountFile);
export const apnsEnabled = () =>
  !!(
    config.push.apns.keyFile &&
    config.push.apns.keyId &&
    config.push.apns.teamId &&
    config.push.apns.bundleId
  );

/**
 * 앱에 내려줄 RTCPeerConnection용 iceServers 배열을 만든다.
 * TURN 은 공유 비밀이 있으면 시간제한 임시 자격증명(권장), 없으면 고정 자격증명을 사용한다.
 * @param {string} [userId] 임시 자격증명 username 에 포함시킬 사용자 식별자(선택)
 */
export function buildIceServers(userId) {
  const servers = [];
  if (config.ice.stunUrls.length) {
    servers.push({ urls: config.ice.stunUrls });
  }
  if (config.ice.turnUrls.length) {
    if (config.ice.turnSecret) {
      // 방식 A: 시간제한 임시 자격증명
      const { username, credential } = makeTurnCredential(
        config.ice.turnSecret,
        config.ice.turnTtlSeconds,
        userId
      );
      servers.push({ urls: config.ice.turnUrls, username, credential });
    } else if (config.ice.turnUsername) {
      // 방식 B: 고정 자격증명
      servers.push({
        urls: config.ice.turnUrls,
        username: config.ice.turnUsername,
        credential: config.ice.turnCredential,
      });
    }
  }
  return servers;
}
