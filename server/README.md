# SecretCall 서버

종단간 암호화 음성통화 앱의 **시그널링 서버 + 아이디 발급 시스템**.
개인정보를 저장하지 않으며, 저장 데이터는 `아이디 · 신원 공개키 · 토큰 해시`뿐입니다.
저장소는 네이티브 빌드가 필요 없는 **순수 JS JSON 파일**(`data/secretcall.json`)이라
어떤 환경에서도 `npm install` 후 바로 실행됩니다. (1,000명 규모에 충분)

## 실행 (개발)

```bash
cd server
cp .env.example .env        # 그리고 ADMIN_KEY 를 긴 랜덤 문자열로 교체
npm install
npm start                   # http://localhost:8080
npm test 은 아직 없음 → 스모크 테스트: (서버 켠 상태에서) node test/smoke.mjs
```

> Node.js 18 이상 필요.
>
> ⚠️ **Windows에서 로컬 실행 시 주의:** 폴더 경로에 **한글이 포함되면**
> (예: `Desktop\클로드`) 일부 Node 버전에서 모듈 로더가 access violation 으로
> 죽는 버그가 있습니다. 로컬 개발은 `C:\dev\secretcall` 처럼 **영문 경로**에
> 두고 실행하세요. 실제 배포 대상인 리눅스 VPS 에서는 해당 문제가 없습니다.

## 아이디 발급 (관리자)

```bash
node admin-cli.js issue kim-01
#  → 아이디: kim-01, 등록코드: (1회용 코드)  ← 사용자에게 전달

node admin-cli.js list       # 사용자 목록
node admin-cli.js disable kim-01
node admin-cli.js delete  kim-01
```

## API 요약

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/register` | 등록코드 | 가입 완료(공개키 등록 → auth_token 발급) |
| GET  | `/api/ice` | 사용자 토큰 | ICE(STUN/TURN) 서버 설정 |
| GET  | `/api/users/:id/pubkey` | 사용자 토큰 | 상대 신원 공개키(안전번호용) |
| POST | `/api/admin/users` | 관리자 키 | 아이디 발급 |
| GET  | `/api/admin/users` | 관리자 키 | 목록 |
| POST | `/api/admin/users/:id/disable` \| `/enable` | 관리자 키 | 중지/재개 |
| DELETE | `/api/admin/users/:id` | 관리자 키 | 삭제 |

- 사용자 인증 헤더: `x-user-id`, `x-auth-token`
- 관리자 인증 헤더: `x-admin-key`

## WebSocket 시그널링 `/ws`

접속 직후 인증 → 통화 신호 중계.

```jsonc
// 1) 인증
{ "type": "auth", "user_id": "kim-01", "auth_token": "..." }
// ← { "type": "auth-ok" }

// 2) 통화 신호 (상대에게 그대로 전달됨, from 은 서버가 확정)
{ "type": "call-offer",  "to": "lee-02", "sdp": "...", "sig": "...", "from_pubkey": "..." }
{ "type": "call-answer", "to": "kim-01", "sdp": "...", "sig": "..." }
{ "type": "ice-candidate", "to": "...", "candidate": { ... } }
{ "type": "call-reject" | "call-hangup" | "call-cancel", "to": "..." }
```

상대가 오프라인이면 `{ "type": "peer-offline", "to": "..." }` 가 발신자에게 돌아옵니다
(실제 배포에서는 이 지점에서 FCM/APNs 푸시로 수신 알림을 보냅니다).

## 보안 메모

- 음성 미디어는 서버를 지나지 않습니다(WebRTC P2P, DTLS-SRTP).
- 서버는 SDP를 중계만 하며, SDP의 DTLS 지문은 발신자의 신원키로 서명됩니다.
  수신자는 서명을 검증하고 **안전번호**를 육안 확인하여 중간자 공격을 차단합니다.
- 운영 시 반드시 HTTPS/WSS(TLS) 뒤에 두세요. `docs/DEPLOY.md` 참고.
