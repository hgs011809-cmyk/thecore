/**
 * 서버 스모크 테스트.
 * 사용법: 먼저 `npm start` 로 서버를 켠 뒤, 다른 터미널에서 `node test/smoke.mjs`.
 * 검증: 아이디발급 → 가입 → WS 인증 → A→B 통화신호 중계.
 */
import 'dotenv/config';
import WebSocket from 'ws';

const PORT = process.env.PORT || 8080;
const BASE = `http://localhost:${PORT}`;
const WS = `ws://localhost:${PORT}/ws`;
const ADMIN = process.env.ADMIN_KEY;

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    pass++;
  } else {
    console.log(`  ❌ ${name}`);
    fail++;
  }
}

async function admin(method, path, body) {
  const r = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-admin-key': ADMIN },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

async function registerUser(prefix) {
  const id = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const issued = await admin('POST', '/admin/users', { user_id: id });
  const code = issued.data.registration_code;
  const reg = await fetch(`${BASE}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      user_id: id,
      registration_code: code,
      identity_public_key: `dummy-pubkey-${id}`,
    }),
  });
  const data = await reg.json();
  return { id, token: data.auth_token, regStatus: reg.status };
}

function connect(id, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', user_id: id, auth_token: token })));
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'auth-ok') resolve(ws);
      if (m.type === 'auth-fail') reject(new Error('auth-fail'));
    });
    ws.on('error', reject);
    setTimeout(() => reject(new Error('timeout')), 4000);
  });
}

(async () => {
  if (!ADMIN || ADMIN === 'change-me-to-a-long-random-string') {
    console.error('ADMIN_KEY 를 .env 에 설정하세요.');
    process.exit(1);
  }
  console.log('SecretCall 서버 스모크 테스트\n');

  // 헬스
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  ok('헬스체크', health.ok === true);

  // 가입
  const alice = await registerUser('alice');
  const bob = await registerUser('bob');
  ok('앨리스 가입', alice.regStatus === 200 && !!alice.token);
  ok('밥 가입', bob.regStatus === 200 && !!bob.token);

  // 잘못된 토큰 인증 거부
  let rejected = false;
  try {
    await connect(alice.id, 'wrong-token');
  } catch {
    rejected = true;
  }
  ok('잘못된 토큰 거부', rejected);

  // 정상 인증
  const wsA = await connect(alice.id, alice.token);
  const wsB = await connect(bob.id, bob.token);
  ok('WS 인증 (A, B)', true);

  // A → B 통화신호 중계
  const relayed = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 3000);
    wsB.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'call-offer') {
        clearTimeout(timer);
        resolve(m);
      }
    });
    wsA.send(
      JSON.stringify({
        type: 'call-offer',
        to: bob.id,
        sdp: 'v=0...(dummy sdp)',
        sig: 'dummy-sig',
        from_pubkey: `dummy-pubkey-${alice.id}`,
      })
    );
  });
  ok('A→B 통화신호 중계', relayed && relayed.type === 'call-offer');
  ok('from 필드를 서버가 확정', relayed && relayed.from === alice.id);

  // ── 오프라인 수신자: 푸시로 깨우고 offer 버퍼링 후 전달 ──
  const carol = await registerUser('carol'); // WS 미접속(오프라인)
  // carol 에 푸시 토큰 등록
  const tok = await fetch(`${BASE}/api/push-token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': carol.id,
      'x-auth-token': carol.token,
    },
    body: JSON.stringify({ platform: 'android', token: 'fake-fcm-token' }),
  });
  ok('푸시 토큰 등록', tok.status === 200);

  // alice → (오프라인) carol : 푸시 토큰이 있으므로 'ringing' 응답 + offer 버퍼
  const ringing = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 3000);
    const handler = (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'ringing' || m.type === 'peer-offline') {
        clearTimeout(timer);
        wsA.off('message', handler);
        resolve(m);
      }
    };
    wsA.on('message', handler);
    wsA.send(
      JSON.stringify({
        type: 'call-offer',
        to: carol.id,
        sdp: 'v=0...(offline dummy)',
        sig: 'sig',
        from_pubkey: `dummy-pubkey-${alice.id}`,
      })
    );
  });
  ok('오프라인+토큰 → ringing 응답', ringing && ringing.type === 'ringing');

  // carol 이 접속하면 버퍼된 offer 를 즉시 받는다
  const wsC = await connect(carol.id, carol.token);
  const buffered = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 3000);
    wsC.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'call-offer') {
        clearTimeout(timer);
        resolve(m);
      }
    });
  });
  ok('접속 시 버퍼된 offer 전달', buffered && buffered.from === alice.id);

  // 정리
  await admin('DELETE', `/admin/users/${alice.id}`);
  await admin('DELETE', `/admin/users/${bob.id}`);
  await admin('DELETE', `/admin/users/${carol.id}`);
  wsA.close();
  wsB.close();
  wsC.close();

  console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('테스트 오류:', e);
  process.exit(1);
});
