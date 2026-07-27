#!/usr/bin/env node
/**
 * 관리자 CLI — 아이디 발급/조회/중지/삭제.
 *
 * 사용법:
 *   node admin-cli.js issue <아이디>      아이디 발급 → 등록코드 출력(1회만!)
 *   node admin-cli.js list                사용자 목록
 *   node admin-cli.js disable <아이디>    사용 중지
 *   node admin-cli.js enable  <아이디>    사용 재개
 *   node admin-cli.js delete  <아이디>    완전 삭제
 *
 * 환경변수: ADMIN_KEY (필수), BASE_URL (기본 http://localhost:PORT)
 */
import 'dotenv/config';

const PORT = process.env.PORT || 8080;
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
const ADMIN_KEY = process.env.ADMIN_KEY;

if (!ADMIN_KEY || ADMIN_KEY === 'change-me-to-a-long-random-string') {
  console.error('환경변수 ADMIN_KEY 를 설정하세요 (.env).');
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-admin-key': ADMIN_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    console.error(`오류 ${res.status}:`, data);
    process.exit(1);
  }
  return data;
}

const [cmd, arg] = process.argv.slice(2);

switch (cmd) {
  case 'issue': {
    if (!arg) fail('아이디를 입력하세요: node admin-cli.js issue <아이디>');
    const r = await api('POST', '/admin/users', { user_id: arg });
    console.log('\n✅ 아이디 발급 완료');
    console.log('  아이디     :', r.user_id);
    console.log('  등록코드   :', r.registration_code);
    console.log('\n⚠️  등록코드는 지금만 표시됩니다. 사용자에게 안전하게 전달하세요.\n');
    break;
  }
  case 'list': {
    const r = await api('GET', '/admin/users');
    console.table(
      r.users.map((u) => ({
        아이디: u.user_id,
        상태: u.status,
        가입: u.registered_at ? new Date(u.registered_at).toLocaleString() : '-',
      }))
    );
    break;
  }
  case 'disable':
    if (!arg) fail('아이디를 입력하세요.');
    await api('POST', `/admin/users/${encodeURIComponent(arg)}/disable`);
    console.log(`⛔ ${arg} 사용 중지됨`);
    break;
  case 'enable':
    if (!arg) fail('아이디를 입력하세요.');
    await api('POST', `/admin/users/${encodeURIComponent(arg)}/enable`);
    console.log(`✅ ${arg} 사용 재개됨`);
    break;
  case 'delete':
    if (!arg) fail('아이디를 입력하세요.');
    await api('DELETE', `/admin/users/${encodeURIComponent(arg)}`);
    console.log(`🗑️  ${arg} 삭제됨`);
    break;
  default:
    console.log(`사용법:
  node admin-cli.js issue <아이디>
  node admin-cli.js list
  node admin-cli.js disable <아이디>
  node admin-cli.js enable  <아이디>
  node admin-cli.js delete  <아이디>`);
}

function fail(m) {
  console.error(m);
  process.exit(1);
}
