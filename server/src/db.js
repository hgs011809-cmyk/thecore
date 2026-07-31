/**
 * 경량 JSON 파일 저장소.
 *
 * 1,000명 규모(쓰기 빈도 낮음)에서는 네이티브 DB가 불필요하다.
 * 네이티브 빌드 의존성 없이 어떤 환경에서도 바로 실행되도록 순수 JS 로 구현.
 * better-sqlite3 와 유사한 { get, all, run } 인터페이스를 제공해 라우트 코드를 그대로 쓴다.
 *
 * 저장 데이터: user_id · registration_code · identity_public_key ·
 *              auth_token_hash · status · created_at · registered_at
 * (전화번호/이메일/이름 등 개인정보 없음)
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const FILE = config.dbPath.replace(/\.db$/i, '.json');
fs.mkdirSync(path.dirname(FILE), { recursive: true });

let state = { users: {} };
if (fs.existsSync(FILE)) {
  try {
    state = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!state.users) state.users = {};
  } catch {
    state = { users: {} };
  }
}

function persist() {
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, FILE); // 원자적 교체
}

export const q = {
  insertIssued: {
    run({ user_id, registration_code, created_at }) {
      state.users[user_id] = {
        user_id,
        registration_code,
        identity_public_key: null,
        encryption_public_key: null, // 메시지 암호화용 공개키(Curve25519)
        auth_token_hash: null,
        status: 'issued',
        created_at,
        registered_at: null,
        push: { fcm: null, apnsVoip: null }, // 수신 알림용 기기 토큰
      };
      persist();
    },
  },

  setEncKey: {
    run({ user_id, enc_public_key }) {
      const u = state.users[user_id];
      if (!u) return;
      u.encryption_public_key = enc_public_key;
      persist();
    },
  },

  setPushToken: {
    run({ user_id, platform, token }) {
      const u = state.users[user_id];
      if (!u) return;
      if (!u.push) u.push = { fcm: null, apnsVoip: null };
      if (platform === 'android') u.push.fcm = token;
      else if (platform === 'ios') u.push.apnsVoip = token;
      persist();
    },
  },

  getUser: {
    get(userId) {
      return state.users[userId];
    },
  },

  listUsers: {
    all() {
      return Object.values(state.users)
        .map((u) => ({
          user_id: u.user_id,
          status: u.status,
          created_at: u.created_at,
          registered_at: u.registered_at,
          has_key: u.identity_public_key ? 1 : 0,
        }))
        .sort((a, b) => b.created_at - a.created_at);
    },
  },

  completeRegistration: {
    run({ user_id, identity_public_key, auth_token_hash, registered_at }) {
      const u = state.users[user_id];
      if (!u) return;
      u.identity_public_key = identity_public_key;
      u.auth_token_hash = auth_token_hash;
      u.registration_code = null;
      u.status = 'registered';
      u.registered_at = registered_at;
      persist();
    },
  },

  setStatus: {
    run({ user_id, status }) {
      const u = state.users[user_id];
      if (!u) return;
      u.status = status;
      persist();
    },
  },

  deleteUser: {
    run(userId) {
      delete state.users[userId];
      persist();
    },
  },

  getPublicKey: {
    get(userId) {
      const u = state.users[userId];
      if (!u) return undefined;
      return { user_id: u.user_id, identity_public_key: u.identity_public_key, status: u.status };
    },
  },
};
