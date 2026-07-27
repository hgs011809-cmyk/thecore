/**
 * TURN 임시 자격증명 로직 테스트. 서버 실행 없이 단독 실행:
 *   node test/turn.mjs
 * coturn 이 검증하는 방식(HMAC-SHA1)과 동일하게 계산되는지 독립적으로 확인한다.
 */
import crypto from 'node:crypto';

// config.js 는 import 시 ADMIN_KEY 를 요구하므로 미리 설정
process.env.ADMIN_KEY = 'test-admin-key-'.padEnd(40, 'x');
process.env.TURN_STATIC_SECRET = 'shared-secret-xyz';
process.env.TURN_URLS = 'turn:call.example.com:3478';
process.env.TURN_TTL_SECONDS = '600';
process.env.STUN_URLS = 'stun:stun.l.google.com:19302';

const { makeTurnCredential } = await import('../src/turn.js');
const { buildIceServers } = await import('../src/config.js');

let pass = 0, fail = 0;
const ok = (n, c) => { console.log((c ? '  ✅ ' : '  ❌ ') + n); c ? pass++ : fail++; };

console.log('TURN 임시 자격증명 테스트\n');

// coturn 과 동일한 규칙으로 독립 검증
function expectedCredential(secret, username) {
  return crypto.createHmac('sha1', secret).update(username).digest('base64');
}

const cred = makeTurnCredential('shared-secret-xyz', 600, 'alice');
const [expiryStr, uid] = cred.username.split(':');
const expiry = Number(expiryStr);
const now = Math.floor(Date.now() / 1000);

ok('username 에 userId 포함', uid === 'alice');
ok('만료시각이 미래(~TTL)', expiry > now + 500 && expiry <= now + 601);
ok('HMAC-SHA1 자격증명이 coturn 규칙과 일치',
  cred.credential === expectedCredential('shared-secret-xyz', cred.username));
ok('userId 없이도 생성 가능', /^\d+$/.test(makeTurnCredential('s', 600).username));

// buildIceServers 통합 확인
const servers = buildIceServers('bob');
const stun = servers.find((s) => String(s.urls).includes('stun'));
const turn = servers.find((s) => String(s.urls).includes('turn'));
ok('STUN 포함', !!stun);
ok('TURN 포함 + username/credential 존재', !!(turn && turn.username && turn.credential));
ok('TURN username 에 bob 포함', turn.username.endsWith(':bob'));
ok('TURN credential 이 유효한 HMAC',
  turn.credential === expectedCredential('shared-secret-xyz', turn.username));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
