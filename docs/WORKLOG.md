# SecretCall 작업기록

> 매 작업 세션마다 이 파일을 갱신합니다. 위쪽 **진행 현황**은 전체 체크리스트(어디까지
> 했는지), 아래 **일자별 기록**은 그날그날 무엇을 했는지 남깁니다.

---

## 📋 진행 현황 (전체 체크리스트)

### 완료 ✅
- [x] 프로젝트 설계 / 아키텍처 문서 (`docs/ARCHITECTURE.md`)
- [x] 서버: 시그널링(WebSocket) + 아이디 발급 API + JSON 파일 저장 — **스모크 10/10**
- [x] 개인정보 없는 가입 플로우 (아이디 + 1회용 등록코드)
- [x] E2EE: WebRTC(DTLS-SRTP) + Ed25519 서명 + 안전번호 — **암호검증 5/5**
- [x] 모바일 앱: 통화 UI(발신/수신/통화중/음소거), CallManager, 보안 저장소
- [x] 관리자 CLI (아이디 발급/목록/삭제)
- [x] 백그라운드 수신 알림: 오프라인 offer 버퍼링 + FCM/APNs VoIP + CallKeep/CallKit (코드 완성)
- [x] TURN 시간제한 임시 자격증명 + coturn 설정/도커 — **로직 8/8**
- [x] 안드로이드 실기기 빌드 가이드 (`docs/BUILD_ANDROID.md`)
- [x] iOS 실기기 빌드 가이드 (`docs/BUILD_IOS.md`)
- [x] 앱 아이콘 (`mobile/assets/` — SVG + PNG + 생성 가이드)
- [x] 개인정보처리방침 템플릿 (`docs/PRIVACY_POLICY.md`)
- [x] 스토어 등록 체크리스트 (`docs/STORE_LISTING.md`)

### 남음 ⏳ (실제 서버·기기·계정 필요 — 대부분 사용자 직접)
- [x] 무료 배포 방법 정리 (`docs/DEPLOY_FREE.md`)
- [ ] VPS 배포 (시그널링 서버 + coturn) — `docs/DEPLOY.md` (또는 무료: `docs/DEPLOY_FREE.md`)
- [ ] Firebase(google-services.json) / APNs(.p8) 키 발급 + 네이티브 설정
- [ ] 실기기 빌드 & 두 대에서 통화·안전번호 확인
- [ ] 개인정보처리방침 URL 웹 게시 + `[대괄호]` 채우기
- [ ] 스토어 스크린샷 촬영, 심사 제출 (Play `.aab` / App Store Archive)
- [ ] (선택) 통화 시간 표시, 최근 통화 목록, 연결 타임아웃 등 부가 기능

---

## 🗓️ 일자별 기록

### 2026-07-27 (프로젝트 착수 ~ 배포 준비 완료)

이날 하루에 설계부터 스토어 준비까지 진행. (검증은 ASCII 경로로 복사해 실행 — 한글 폴더
Node 이슈 회피)

- **설계·문서** — E2EE 통화 전용 메신저 구조 확정(WebRTC P2P + 시그널링 서버).
  `docs/ARCHITECTURE.md` 작성.
- **서버 구축** — Node.js 시그널링(WebSocket), 아이디 발급/등록 REST API, JSON 파일 저장소,
  관리자 CLI. 스모크 테스트 **10/10** (헬스체크·가입·인증·중계·오프라인 버퍼링).
- **E2EE 구현·검증** — Ed25519 신원키로 SDP 지문 서명, 안전번호(TOFU), 중간자 공격 차단.
  암호 검증 테스트 **5/5**.
- **모바일 앱** — React Native. 가입/홈/통화 화면, CallManager(발신·수신·암호검증),
  Keychain/Keystore 보안 저장.
- **백그라운드 수신 알림** — 서버: 오프라인 상대 offer 버퍼링 + FCM v1/APNs VoIP 발송(내장
  crypto/http2로 직접 구현). 앱: CallKeep/CallKit + 잠금화면 '받기' 자동수락. 서버측 **10/10**.
  → `docs/PUSH_SETUP.md`
- **TURN 임시 자격증명** — coturn use-auth-secret 방식(HMAC-SHA1)으로 10분짜리 자격증명 발급,
  앱이 통화 직전 갱신. `deploy/`에 coturn.conf + docker-compose. 로직 **8/8**. → `docs/DEPLOY.md`
- **빌드 가이드** — 안드로이드(`docs/BUILD_ANDROID.md`), iOS(`docs/BUILD_IOS.md`) 실기기 빌드
  전 과정 문서화.
- **앱 아이콘** — 다크+파랑 수화기+자물쇠 아이콘 SVG 제작, PNG 렌더링 확인(`mobile/assets/`).
- **개인정보·스토어** — 개인정보처리방침 템플릿, 스토어 등록 체크리스트(Play 데이터 보안 /
  App Store 개인정보 라벨 답변표 포함).

**검증 요약:** 서버 스모크 10/10 · E2EE 5/5 · TURN 8/8 (모두 실제 실행).
**다음 예정:** 위 "남음 ⏳" 항목 — 실제 배포/기기/계정이 필요한 단계.

---

### 2026-07-27 (추가) — 무료 배포 방법

- **무료 배포 문서 작성** (`docs/DEPLOY_FREE.md`): 비용 0원 경로 정리.
  - 정직한 경계표: 안드로이드는 완전 무료 배포 가능(APK 사이드로드+FCM), iOS 는 Apple
    개발자 $99/년 없이는 실질 불가(무료 서명 7일 제한·푸시 불가).
  - 경로 A(추천): 오라클 클라우드 Always Free VM — 공인 IP+무료 대역폭으로 시그널링+coturn
    한 대에서, DuckDNS 무료 도메인 + Caddy 자동 TLS. 디스크 유지로 가입자 데이터 보존.
  - 경로 B(빠른 테스트): Koyeb/Render 무료 PaaS + OpenRelay 무료 TURN. 단, PaaS 무료는
    파일시스템 임시라 재시작 시 데이터 초기화 → 시연용.
  - 확인: 서버가 `PORT` 환경변수 사용(PaaS 호환), JSON 파일 저장소(VM 디스크 유지 필요).
- **다음 예정:** 사용자가 오라클/PaaS 중 택해 실제 배포 → APK 빌드·사이드로드.

### 2026-07-27 (추가2) — 빠른 무료 배포 준비 (Render)

사용자 결정: 최종본 전이라 **빠르고 쉬운** 테스트 배포 → Render 무료 + Firebase 포함.

- **서버에 `SEED_USERS` 기능 추가** — 환경변수 `id:code,id2:code2` 로 테스트 계정을
  시작 시 자동 생성(이미 있으면 유지). 무료 PaaS 재시작 시 저장소 초기화돼도 테스트
  계정이 되살아나게. (`config.js`, `server.js`)
  - **검증:** 시드 로그 출력 확인, 시드 코드로 가입 200 + 토큰 발급, 틀린 코드 401,
    OpenRelay 고정 TURN 자격증명이 `/register` ice_servers 에 정상 포함됨.
- **`render.yaml` 블루프린트 추가** — 저장소 연결만 하면 자동 배포. ADMIN_KEY 자동생성,
  시드 계정(phoneA/111111, phoneB/222222), STUN, 무료 공개 TURN(OpenRelay) 프리셋.
- **`docs/DEPLOY_RENDER.md` 작성** — GitHub 올리기 → Render 원클릭 → Firebase 5분 →
  config.ts 주소 교체 → APK 빌드 → 폰 2대 통화, 단계별.
- **다음 예정:** 사용자가 ① GitHub push → ② Render Blueprint 배포 →
  `/api/health` 확인 → ③ Firebase → ④ APK 빌드. (막히는 지점 함께 해결)

<!-- 다음 작업 시 아래 형식으로 새 날짜 블록을 추가하세요:
### YYYY-MM-DD (한 줄 요약)
- 무엇을 했는지
- 검증/결과
- 다음 예정
그리고 위 "진행 현황" 체크리스트도 함께 갱신.
-->
