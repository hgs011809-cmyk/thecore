# SecretCall 모바일 앱 (React Native)

개인정보 없이 아이디만으로 가입하고, 상대 아이디로 **종단간 암호화 음성통화**를 하는 앱.

## 구성

```
mobile/
  App.tsx                     화면 라우팅(가입 → 홈 → 통화 오버레이)
  index.js                    진입점(+ 난수 폴리필)
  src/
    config.ts                 서버 주소(개발/배포)
    crypto/identity.ts        Ed25519 신원키·서명·안전번호
    storage/secureStore.ts    Keychain/Keystore 보안 저장
    api/rest.ts               가입·ICE·공개키 조회
    signaling/SignalingClient WebSocket 시그널링
    webrtc/CallManager.ts     WebRTC 통화 핵심(발신/수신/암호검증)
    push/pushClient.ts        FCM/VoIP 토큰 등록 + 수신 처리
    push/callService.ts       CallKeep/CallKit 전화 화면
    permissions.ts            마이크 권한
    screens/                  Register / Home / Call 화면
```

> 백그라운드 수신 알림(앱 종료 시에도 전화 오기)은 구현되어 있으며, Firebase/APNs
> 키 발급과 네이티브 설정이 필요합니다 → [../docs/PUSH_SETUP.md](../docs/PUSH_SETUP.md)

## 사전 준비

- Node.js 18+
- Android: Android Studio + JDK 17 (에뮬레이터 또는 실기기)
- iOS: macOS + Xcode + CocoaPods (실기기 권장)

> 📱 **실기기에 처음 설치하는 경우**, 준비물부터 빌드까지 한 번에 정리한 가이드를 따라 하세요:
> [안드로이드](../docs/BUILD_ANDROID.md) · [iOS](../docs/BUILD_IOS.md) (아이콘: [assets/ICON.md](assets/ICON.md))

## 네이티브 프로젝트 생성 (최초 1회)

이 저장소에는 순수 소스만 있습니다. 플랫폼 빌드 폴더(`android/`, `ios/`)는
React Native CLI로 한 번 생성한 뒤 아래 파일들을 얹으면 됩니다.

```bash
# 1) 같은 버전으로 임시 프로젝트 생성
npx @react-native-community/cli@latest init SecretCall --version 0.75.4
# 2) 생성된 SecretCall/android, SecretCall/ios 폴더를 이 mobile/ 로 복사
# 3) 이 폴더에서 의존성 설치
npm install
# iOS 추가
cd ios && pod install && cd ..
```

> 팁: 반대로, 생성된 프로젝트 폴더에 이 저장소의 `src/`, `App.tsx`, `index.js`,
> `package.json`의 dependencies를 병합해도 됩니다.

## 네이티브 권한 설정 (필수)

**Android — `android/app/src/main/AndroidManifest.xml`** 에 추가:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

`android/app/build.gradle` 의 `minSdkVersion` 은 24 이상.

**iOS — `ios/SecretCall/Info.plist`** 에 추가:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>통화를 위해 마이크를 사용합니다.</string>
```

## 실행 (개발)

먼저 서버를 켠 상태에서(`../server`):

```bash
npm start                 # Metro 번들러
npm run android           # 안드로이드 (에뮬레이터는 서버를 10.0.2.2 로 접근)
npm run ios               # iOS
```

`src/config.ts` 의 개발/배포 서버 주소를 환경에 맞게 확인하세요.

## 사용 흐름

1. 관리자에게 받은 **아이디 + 등록코드**로 가입 (기기에서 암호화 키 생성)
2. 홈에서 상대 **아이디** 입력 → 통화
3. 연결되면 화면의 **안전번호**를 상대와 비교(최초 1회) → 도청·중간자 없음 확인

## 보안 요약

- 음성은 P2P(WebRTC DTLS-SRTP)로만 흐르며 서버를 지나지 않습니다.
- SDP(DTLS 지문)는 신원키로 서명·검증되어 서버발 중간자 공격을 차단합니다.
- 개인키는 기기 보안저장소(Keychain/Keystore)에만 존재합니다.
- 서버에는 개인정보가 없고 `아이디·공개키·토큰 해시`만 저장됩니다.

## 남은 배포 작업 (프로덕션)

- 백그라운드 수신 알림 **키 발급 + 네이티브 설정** — `../docs/PUSH_SETUP.md` (코드는 구현 완료)
- TURN 서버 연동(방화벽 환경 통화 성공률↑) — `../docs/DEPLOY.md`
- 앱 아이콘/스토어 등록
