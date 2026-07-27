# 🔒 SecretCall — 종단간 암호화 음성통화 앱

개인정보 없이 **아이디만으로** 가입하고, 상대 아이디만 알면 **종단간 암호화(E2EE) 통화**를
할 수 있는 통화 전용 메신저. (문자 기능 없음)

## 특징

- 📞 1:1 음성통화 (WebRTC P2P, DTLS-SRTP 암호화)
- 🔐 종단간 암호화 + **안전번호** 육안 확인으로 중간자 공격 차단
- 🕵️ 개인정보 미수집: 개발사가 발급한 `아이디 + 1회용 등록코드`로 가입
- 📱 안드로이드 / iOS (React Native)
- 💸 1,000명 규모 운영비 월 $20~35 수준 (음성이 서버를 안 지나므로 대역폭 저렴)

## 구조

| 폴더 | 내용 |
|------|------|
| [`server/`](server/) | 시그널링 서버 + 아이디 발급 시스템 (Node.js) |
| [`mobile/`](mobile/) | React Native 앱 (전화기 앱) |
| [`docs/`](docs/) | [설계](docs/ARCHITECTURE.md) · [배포](docs/DEPLOY.md)/[무료](docs/DEPLOY_FREE.md)/[Render 빠른배포](docs/DEPLOY_RENDER.md) · [안드로이드](docs/BUILD_ANDROID.md)/[iOS 빌드](docs/BUILD_IOS.md) · [푸시](docs/PUSH_SETUP.md) · [개인정보처리방침](docs/PRIVACY_POLICY.md) · [스토어 등록](docs/STORE_LISTING.md) |
| [`deploy/`](deploy/) | coturn(TURN) 설정 + docker-compose |

## 빠른 시작

```bash
# 1) 서버
cd server && cp .env.example .env   # ADMIN_KEY 교체
npm install && npm start

# 2) 아이디 발급
node admin-cli.js issue kim-01      # 등록코드 출력 → 사용자에게 전달

# 3) 앱 (mobile/README.md 참고: 네이티브 폴더 생성 후)
cd ../mobile && npm install && npm run android
```

## 완성도

- ✅ 개인정보 없는 아이디 발급/가입/인증
- ✅ WebRTC 음성통화 발신·수신·종료
- ✅ 신원키 서명 + 안전번호로 E2EE 검증
- ✅ 통화 UI (발신/수신/통화중/음소거)
- ✅ 백그라운드 수신 알림 (오프라인 offer 버퍼링 + FCM/APNs VoIP + CallKeep/CallKit)
     — 서버 로직 검증 완료, 배포 시 키 발급/네이티브 설정 필요 ([docs/PUSH_SETUP.md](docs/PUSH_SETUP.md))
- ✅ TURN 시간제한 임시 자격증명 (방화벽 환경 통화 성공률↑) — 로직 검증 완료,
     coturn 설정/도커 포함 ([deploy/](deploy/)). 배포 시 VPS(공인 IP) 필요
- ✅ 실기기 빌드 가이드 — [안드로이드](docs/BUILD_ANDROID.md) / [iOS](docs/BUILD_IOS.md)
- ✅ 앱 아이콘 ([mobile/assets/](mobile/assets/) — SVG 원본 + PNG + 생성 가이드)
- ✅ 개인정보처리방침 + 스토어 등록 체크리스트 ([privacy](docs/PRIVACY_POLICY.md) · [listing](docs/STORE_LISTING.md))
- ⏳ 사용자가 직접: 스크린샷 촬영, 실계정 심사 제출, 방침 URL 게시

자세한 설계와 보안 모델은 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 참고.
