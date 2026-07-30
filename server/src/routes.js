import express from 'express';
import { q } from './db.js';
import {
  randomToken,
  hashToken,
  authenticate,
  isAdmin,
} from './auth.js';
import { config, buildIceServers } from './config.js';

const USER_ID_RE = /^[a-zA-Z0-9._-]{3,32}$/;

export const router = express.Router();

/* ------------------------------------------------------------------ */
/* 공개 / 사용자 라우트                                                  */
/* ------------------------------------------------------------------ */

// 헬스체크
router.get('/health', (_req, res) => res.json({ ok: true }));

/**
 * 가입 완료. 앱이 신원 키쌍을 만든 뒤 공개키를 등록하고 auth_token 을 받는다.
 * body: { user_id, registration_code, identity_public_key }
 */
router.post('/register', (req, res) => {
  const { user_id, registration_code, identity_public_key } = req.body || {};

  if (!user_id || !registration_code || !identity_public_key) {
    return res.status(400).json({ error: 'user_id, registration_code, identity_public_key 가 필요합니다.' });
  }
  const user = q.getUser.get(user_id);
  if (!user) {
    return res.status(404).json({ error: '존재하지 않는 아이디입니다.' });
  }
  if (user.status === 'disabled') {
    return res.status(403).json({ error: '사용 중지된 아이디입니다.' });
  }
  // 테스트용 시드 계정은 코드만 맞으면 언제든 재가입(재로그인) 허용.
  // 일반 계정은 최초 1회만 가입 가능(등록코드 소진).
  const seed = config.seedUsers.find((s) => s.user_id === user_id);
  if (!seed && user.status === 'registered') {
    return res.status(409).json({ error: '이미 가입된 아이디입니다. 재발급이 필요하면 관리자에게 문의하세요.' });
  }
  const expectedCode = seed ? seed.registration_code : user.registration_code;
  if (expectedCode !== registration_code) {
    return res.status(401).json({ error: '등록코드가 올바르지 않습니다.' });
  }
  if (typeof identity_public_key !== 'string' || identity_public_key.length > 512) {
    return res.status(400).json({ error: '공개키 형식이 올바르지 않습니다.' });
  }

  const authToken = randomToken(config.authTokenBytes);
  q.completeRegistration.run({
    user_id,
    identity_public_key,
    auth_token_hash: hashToken(authToken),
    registered_at: Date.now(),
  });

  res.json({
    ok: true,
    user_id,
    auth_token: authToken, // 앱은 이 토큰을 기기 보안저장소에 보관
    ice_servers: buildIceServers(user_id),
  });
});

// 인증 미들웨어: 헤더 x-user-id, x-auth-token
function requireAuth(req, res, next) {
  const user = authenticate(req.get('x-user-id'), req.get('x-auth-token'));
  if (!user) return res.status(401).json({ error: '인증 실패' });
  req.user = user;
  next();
}

// 최신 ICE 서버 설정 조회 (앱이 통화 직전 갱신 — 임시 자격증명 새로 발급됨)
router.get('/ice', requireAuth, (req, res) => {
  res.json({ ice_servers: buildIceServers(req.user.user_id) });
});

// 수신 알림용 기기 푸시 토큰 등록/갱신
router.post('/push-token', requireAuth, (req, res) => {
  const { platform, token } = req.body || {};
  if (!['android', 'ios'].includes(platform) || typeof token !== 'string' || !token) {
    return res.status(400).json({ error: 'platform(android|ios) 과 token 이 필요합니다.' });
  }
  q.setPushToken.run({ user_id: req.user.user_id, platform, token });
  res.json({ ok: true });
});

// 상대방 신원 공개키 조회 (안전번호 계산/검증용)
router.get('/users/:id/pubkey', requireAuth, (req, res) => {
  const row = q.getPublicKey.get(req.params.id);
  if (!row || row.status !== 'registered' || !row.identity_public_key) {
    return res.status(404).json({ error: '등록된 사용자가 아닙니다.' });
  }
  res.json({ user_id: row.user_id, identity_public_key: row.identity_public_key });
});

/* ------------------------------------------------------------------ */
/* 관리자 라우트 (x-admin-key 필요)                                      */
/* ------------------------------------------------------------------ */

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: '관리자 인증 실패' });
  next();
}

// 아이디 발급. body: { user_id }  → registration_code 반환(1회만 표시됨)
router.post('/admin/users', requireAdmin, (req, res) => {
  const { user_id } = req.body || {};
  if (!USER_ID_RE.test(user_id || '')) {
    return res.status(400).json({ error: '아이디는 3~32자의 영문/숫자/. _ - 만 허용됩니다.' });
  }
  if (q.getUser.get(user_id)) {
    return res.status(409).json({ error: '이미 존재하는 아이디입니다.' });
  }
  const registrationCode = randomToken(config.registrationCodeBytes);
  q.insertIssued.run({
    user_id,
    registration_code: registrationCode,
    created_at: Date.now(),
  });
  res.status(201).json({ user_id, registration_code: registrationCode });
});

// 사용자 목록
router.get('/admin/users', requireAdmin, (_req, res) => {
  res.json({ users: q.listUsers.all() });
});

// 사용 중지 / 재개
router.post('/admin/users/:id/disable', requireAdmin, (req, res) => {
  if (!q.getUser.get(req.params.id)) return res.status(404).json({ error: '없는 아이디' });
  q.setStatus.run({ user_id: req.params.id, status: 'disabled' });
  res.json({ ok: true });
});
router.post('/admin/users/:id/enable', requireAdmin, (req, res) => {
  const u = q.getUser.get(req.params.id);
  if (!u) return res.status(404).json({ error: '없는 아이디' });
  q.setStatus.run({ user_id: req.params.id, status: u.identity_public_key ? 'registered' : 'issued' });
  res.json({ ok: true });
});

// 삭제 (개인정보가 없으므로 완전 삭제)
router.delete('/admin/users/:id', requireAdmin, (req, res) => {
  if (!q.getUser.get(req.params.id)) return res.status(404).json({ error: '없는 아이디' });
  q.deleteUser.run(req.params.id);
  res.json({ ok: true });
});
