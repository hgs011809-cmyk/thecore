import crypto from 'node:crypto';
import { config } from './config.js';
import { q } from './db.js';

/** URL-safe 랜덤 문자열 생성 (등록코드/토큰용). */
export function randomToken(bytes) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** 토큰을 저장용으로 해시. 원문은 저장하지 않는다. */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** 타이밍 공격에 안전한 문자열 비교. */
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * user_id + auth_token 을 검증한다.
 * @returns {object|null} 유효하면 user row, 아니면 null
 */
export function authenticate(userId, authToken) {
  if (!userId || !authToken) return null;
  const user = q.getUser.get(userId);
  if (!user || user.status !== 'registered' || !user.auth_token_hash) return null;
  if (!safeEqual(hashToken(authToken), user.auth_token_hash)) return null;
  return user;
}

/** 관리자 API 키 검증. */
export function isAdmin(req) {
  const key = req.get('x-admin-key') || '';
  return safeEqual(key, config.adminKey) && key.length > 0;
}
