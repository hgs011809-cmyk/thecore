# 무료로 배포하기 (비용 0원 목표)

지금 만든 SecretCall 을 **돈 안 들이고** 올리는 방법입니다. 먼저 어디까지 공짜가 되는지
정직하게 선을 그은 뒤, 추천 경로를 안내합니다.

---

## 0. 무료로 되는 것 / 안 되는 것

| 항목 | 무료 가능? | 비고 |
|------|-----------|------|
| 시그널링 서버 | ✅ | 공짜 VM(오라클) 또는 무료 PaaS |
| STUN | ✅ | 공개 STUN 또는 자체 coturn |
| TURN(중계) | ✅ | 공짜 VM의 coturn, 또는 무료 공개 TURN(OpenRelay) |
| HTTPS/WSS(TLS) | ✅ | Let's Encrypt / Caddy 자동, PaaS는 기본 제공 |
| 도메인 | ✅ | DuckDNS 등 무료 서브도메인 |
| **안드로이드 푸시(FCM)** | ✅ | Firebase 무료 |
| 안드로이드 앱 배포 | ✅ | **APK 직접 배포(사이드로드)** 로 스토어 없이 무료 |
| **iOS 푸시(APNs)** | ❌ | **Apple 개발자 $99/년 필수** |
| iOS 앱 배포 | ❌(사실상) | 무료 서명은 7일마다 재설치 + 푸시 불가 |
| Google Play 등록 | ❌ | 1회 $25 (사이드로드로 우회 가능) |

> 요약: **안드로이드는 완전 무료로 실사용 배포 가능.** iOS 는 Apple 정책상 무료로는
> 실질적 배포가 안 됩니다(테스트용 7일 설치만 가능, 백그라운드 수신 알림 불가).

---

## 🥇 추천 경로 A — 오라클 클라우드 Always Free (전부 한 대에서, 진짜 무료)

**왜 추천:** TURN 은 공인 IP + 대역폭이 필요한데, 오라클 Always Free VM 은 **공인 IP + 넉넉한
무료 대역폭(월 10TB)** 을 영구 무료로 줍니다. 시그널링 서버와 coturn 을 한 VM 에서 돌리고
디스크가 유지되어 가입자 데이터도 안 날아갑니다. (무료 PaaS 는 재시작 시 데이터 초기화)

### A-1. VM 생성
1. https://www.oracle.com/cloud/free — 계정 생성(카드 인증은 있으나 Always Free 는 과금 안 됨)
2. Compute Instance 생성: **Always Free** 자격의 Ampere(ARM) 또는 VM.Standard.E2.1.Micro
3. 공인 IP 발급(기본). SSH 키로 접속
4. **방화벽/보안목록(Ingress)** 개방:
   - `443/tcp`(HTTPS/WSS), `3478/tcp+udp`, `5349/tcp+udp`, `49152-65535/udp`(TURN 릴레이)
   - VM 내부 `iptables` 도 열어야 할 수 있음(오라클 이미지 특성): `sudo iptables` 규칙 추가

### A-2. 무료 도메인 (DuckDNS)
- https://www.duckdns.org 에서 `yourname.duckdns.org` 생성 → VM 공인 IP 로 지정

### A-3. 무료 TLS + 리버스 프록시 (Caddy)
Caddy 는 Let's Encrypt 인증서를 자동 발급/갱신합니다. `/etc/caddy/Caddyfile`:
```
yourname.duckdns.org {
    reverse_proxy localhost:8080
}
```
```bash
sudo apt install -y caddy   # 또는 공식 설치 스크립트
sudo systemctl restart caddy
```
→ 이제 `https://yourname.duckdns.org` 와 `wss://yourname.duckdns.org/ws` 가 TLS 로 열립니다.

### A-4. 시그널링 서버 실행
```bash
# Node 20+ 설치 후
cd server
npm install
# .env 설정
#   ADMIN_KEY=<긴 랜덤>
#   TURN_URLS=turn:yourname.duckdns.org:3478
#   TURN_STATIC_SECRET=<긴 랜덤>   (coturn 과 동일)
#   STUN_URLS=stun:yourname.duckdns.org:3478
npm start
# 상시 실행: pm2 또는 systemd 로 데몬화
sudo npm i -g pm2 && pm2 start src/server.js --name secretcall && pm2 save
```

### A-5. TURN(coturn) 실행 — 같은 VM
`deploy/` 를 VM 에 올린 뒤:
```bash
cd deploy
# coturn/turnserver.conf 에서 static-auth-secret=<A-4와 동일>, external-ip=<공인 IP>,
#   realm=yourname.duckdns.org 로 수정
docker compose up -d      # (docker 없으면 sudo apt install docker.io docker-compose-plugin)
```

### A-6. 앱 연결
- `mobile/src/config.ts`:
  ```ts
  const PROD_HTTP = 'https://yourname.duckdns.org';
  const PROD_WS   = 'wss://yourname.duckdns.org/ws';
  ```
- 릴리스 APK 빌드(`docs/BUILD_ANDROID.md` ⑥) → 사이드로드 배포

---

## 🥈 경로 B — 가장 빠른 무료 테스트 (서버 관리 없이)

서버 admin 이 부담이면, PaaS + 무료 공개 TURN 으로 몇 분 만에 띄웁니다.
**주의:** 무료 PaaS 는 파일시스템이 임시라 **재시작 시 가입자 데이터가 초기화**됩니다.
소규모 테스트/시연용으로만 권장.

### B-1. 시그널링 = 무료 PaaS
- **Koyeb**(무료 인스턴스 1개, 상시 실행) 또는 **Render**(무료, 15분 유휴 시 슬립→첫 통화 지연)
- 이 저장소 `server/` 를 배포. 빌드 명령 `npm install`, 시작 `node src/server.js`
- 플랫폼이 `PORT` 를 주입하고 **https/wss 도메인을 무료 제공** → 그대로 사용
- 환경변수에 `ADMIN_KEY` 등 설정

### B-2. TURN = 무료 공개 서버(OpenRelay)
자체 coturn 없이, Metered 의 무료 공개 TURN 을 씁니다(대역폭 제한 있음).
서버 `.env` 에 **고정 자격증명(방식 B)** 으로:
```
STUN_URLS=stun:stun.l.google.com:19302
TURN_URLS=turn:openrelay.metered.ca:80,turn:openrelay.metered.ca:443
TURN_USERNAME=openrelayproject
TURN_CREDENTIAL=openrelayproject
```
> 공개 TURN 값은 제공처 정책에 따라 바뀔 수 있으니 최신 값을 확인하세요.

### B-3. 앱 연결
경로 A-6 과 동일하게 PaaS 도메인으로 `PROD_HTTP`/`PROD_WS` 설정 → APK 사이드로드.

---

## 안드로이드 무료 배포 (스토어 비용 없이)

1. `docs/BUILD_ANDROID.md` ⑥ 으로 **서명된 릴리스 APK** 생성
2. APK 를 사용자에게 전달(다운로드 링크/파일). 사용자는 "출처를 알 수 없는 앱 설치" 허용 후 설치
3. 아이디/등록코드는 `node admin-cli.js issue <아이디>` 로 발급해 전달
- 장점: Google Play $25 없이 배포. 단점: 자동 업데이트 없음(새 APK 재배포)

## iOS 를 무료로? — 솔직한 결론

- 무료 Apple ID 로 Xcode 개발 서명은 가능하지만 **7일마다 재설치**해야 하고,
  **Push/VoIP(수신 알림)·CallKit 백그라운드가 제한**됩니다 → 이 앱의 핵심 기능이 안 됩니다.
- iOS 를 제대로 배포하려면 **Apple Developer Program $99/년** 이 사실상 필수입니다.
- 따라서 "비용 0원" 배포는 **안드로이드 우선**을 권합니다.

---

## 무료 경로의 한계 (실사용 1,000명 관점)

- 무료 VM/PaaS 는 CPU·대역폭·가동시간에 제한이 있어, 이용자가 늘고 TURN 중계가 많아지면
  결국 유료 VPS(월 $20~30, `docs/DEPLOY.md`)로 올리는 것이 안정적입니다.
- 무료 PaaS 데이터 초기화 이슈 때문에, 실제 회원 운영은 **경로 A(오라클, 디스크 유지)** 권장.
- 오라클 Always Free 는 계정 승인/유휴 회수 정책이 있으니 데이터 백업(JSON 파일)을 주기적으로.
