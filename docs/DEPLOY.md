# 배포 가이드 (1,000명 규모)

VPS 1대에 **시그널링 서버 + coturn(STUN/TURN)** 를 함께 올리는 구성. 월 $20~30 수준.

## 0. 준비물

- 리눅스 VPS (Ubuntu 22.04, 2vCPU / 2GB RAM 권장)
- 도메인 (예: `call.example.com`)
- 방화벽에서 열 포트: 443(TLS), 3478/tcp+udp(TURN), 49152-65535/udp(TURN 릴레이)

## 1. 시그널링 서버 올리기

```bash
sudo apt update && sudo apt install -y nodejs npm
git clone <이 저장소> && cd server
cp .env.example .env
#  .env 에서 ADMIN_KEY 를 긴 랜덤 문자열로 교체
npm install
```

프로세스 관리는 pm2 권장:

```bash
sudo npm i -g pm2
pm2 start src/server.js --name secretcall
pm2 save && pm2 startup
```

## 2. TLS 리버스 프록시 (Caddy — 인증서 자동)

```bash
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
call.example.com {
    reverse_proxy localhost:8080
}
```

```bash
sudo systemctl restart caddy
```

이제 `https://call.example.com` (REST), `wss://call.example.com/ws` (시그널링) 로 접근됩니다.
→ 앱 `mobile/src/config.ts` 의 `PROD_HTTP`, `PROD_WS` 를 이 주소로 교체.

## 3. coturn (STUN/TURN) 설치 — 시간제한 임시 자격증명 방식(권장)

고정 비밀번호 대신 **시간제한 임시 자격증명**을 사용합니다(유출돼도 10분 뒤 만료).
서버가 통화 직전 `/api/ice` 에서 HMAC 자격증명을 발급하고, coturn 은 **같은 공유 비밀**로
검증합니다. 관련 코드·설정은 이미 구현되어 있습니다(`server/src/turn.js`,
`deploy/coturn/turnserver.conf`, `deploy/docker-compose.yml`).

### 3-1. 공유 비밀 생성 (양쪽 동일하게!)

```bash
openssl rand -hex 32     # 출력값을 아래 두 곳에 똑같이 넣습니다
```

- 서버 `.env` → `TURN_STATIC_SECRET=<위 값>`
- coturn `turnserver.conf` → `static-auth-secret=<위 값>`

### 3-2. 도커로 coturn 실행 (가장 간단)

```bash
cd deploy
# coturn/turnserver.conf 에서 static-auth-secret, external-ip(=VPS 공인 IP), realm 수정
docker compose up -d
docker logs -f secretcall-coturn      # 동작 확인
```

> 직접 설치를 원하면 `sudo apt install coturn` 후 위 `turnserver.conf` 를
> `/etc/turnserver.conf` 로 복사하고 `systemctl restart coturn`.

### 3-3. 서버 `.env` 에 TURN 반영

```
STUN_URLS=stun:call.example.com:3478
TURN_URLS=turn:call.example.com:3478
TURN_STATIC_SECRET=<3-1 에서 만든 동일한 값>
TURN_TTL_SECONDS=600
```

### 3-4. 검증

```bash
cd server && node test/turn.mjs    # HMAC 자격증명 로직 확인
# 실제 릴레이 확인: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
#  위 페이지에 turn URL/username/credential 을 넣어 'relay' 후보가 나오면 성공
```

방화벽 개방: `3478/tcp+udp`, `5349/tcp+udp`, `49152-65535/udp`.

## 4. 아이디 발급 운영

```bash
cd server
node admin-cli.js issue kim-01    # → 등록코드 출력
node admin-cli.js list
```

발급한 `아이디 + 등록코드`를 사용자에게 오프라인으로 전달하면, 사용자는 앱에서
개인정보 없이 가입합니다.

## 5. 수신 알림(백그라운드) — 프로덕션 필수 추가 작업

앱이 꺼져 있을 때도 전화가 오게 하려면:

- **Android:** Firebase Cloud Messaging(FCM) 고우선순위 메시지 → 앱 깨우기 →
  `ConnectionService`(전화 UI)
- **iOS:** APNs **VoIP 푸시(PushKit)** → **CallKit**(iOS 는 VoIP 푸시 수신 시
  반드시 CallKit 통화 보고 필요)

서버 `signaling.js` 의 `peer-offline` 지점에서 상대에게 푸시를 보내도록 연동합니다.
(현재 코드는 이 지점에 훅만 남겨둔 상태)

## 비용 재확인 (1,000명)

| 항목 | 월 비용 |
|------|---------|
| VPS(시그널링+coturn) | $20~30 |
| 도메인 | ~$1 (연 $12) |
| FCM/APNs | 무료 |
| **합계** | **월 $20~35** (+ Apple 개발자 연 $99) |
