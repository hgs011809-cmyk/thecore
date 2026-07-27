import crypto from 'node:crypto';

/**
 * 시간제한 임시 TURN 자격증명 생성 (coturn `use-auth-secret` / TURN REST API 방식).
 *
 * coturn 과 서버가 동일한 공유 비밀(static-auth-secret)만 나눠 가지면,
 * 서버는 아래 규칙으로 짧은 수명의 username/password 를 만들어 앱에 내려주고,
 * coturn 은 같은 규칙으로 검증한다. 자격증명이 유출돼도 곧 만료되므로,
 * 고정 비밀번호를 앱에 심는 것보다 훨씬 안전하다.
 *
 *   username = <만료 UNIX 시각>[":" <userId>]
 *   password = base64( HMAC-SHA1( secret, username ) )
 *
 * @param {string} secret     coturn 과 공유하는 비밀
 * @param {number} ttlSeconds 자격증명 유효 시간(초)
 * @param {string} [userId]   선택: username 에 포함시킬 사용자 식별자
 */
export function makeTurnCredential(secret, ttlSeconds, userId) {
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = userId ? `${expiry}:${userId}` : String(expiry);
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential, ttl: ttlSeconds };
}
