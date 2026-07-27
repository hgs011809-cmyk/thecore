# iOS 실기기 빌드 가이드 (Mac 필요)

> ⚠️ iOS 빌드는 **macOS + Xcode 가 반드시 필요**합니다. Windows 에서는 불가합니다.
> 또한 실기기 설치·배포에는 **Apple Developer Program(연 $99)** 가입이 필요합니다.

크게 **① 준비 → ② 네이티브 프로젝트 → ③ iOS 설정(권한/Capabilities/Pods) →
④ PushKit·CallKit 코드 → ⑤ 서버 연결 → ⑥ 실기기 실행 → ⑦ TestFlight/배포** 순서입니다.

---

## ① 준비물

1. **Mac** (Apple Silicon 권장) + **Xcode** (App Store, 최신)
2. Xcode 최초 실행 후: `xcode-select --install` (CommandLineTools)
3. **CocoaPods**: `sudo gem install cocoapods` (또는 `brew install cocoapods`)
4. **Node.js 18+**, **watchman**(`brew install watchman`)
5. **Apple Developer 계정** + 아이폰(USB 또는 무선 디버깅)

확인: `xcodebuild -version`, `pod --version`, `node -v` 정상 출력.

---

## ② 네이티브 프로젝트 생성 후 소스 얹기

```bash
npx @react-native-community/cli@latest init SecretCall --version 0.75.4
```

생성된 `SecretCall/ios` 폴더를 이 저장소의 `mobile/ios` 로 복사한 뒤:

```bash
cd mobile
npm install
cd ios && pod install && cd ..
```

> 이후 iOS 는 항상 `ios/SecretCall.xcworkspace` (`.xcodeproj` 아님)를 Xcode 로 엽니다.

---

## ③ iOS 설정

### 3-1. 마이크 권한 — `ios/SecretCall/Info.plist`

```xml
<key>NSMicrophoneUsageDescription</key>
<string>통화를 위해 마이크를 사용합니다.</string>
```

### 3-2. Capabilities (Xcode → 타깃 → Signing & Capabilities → + Capability)

- **Push Notifications**
- **Background Modes** → 체크: **Voice over IP**, **Remote notifications**,
  **Background fetch**, **Audio, AirPlay, and Picture in Picture**

### 3-3. Firebase(GoogleService-Info.plist)

iOS 수신은 PushKit(VoIP)을 쓰지만, `@react-native-firebase` pod 가 링크되어 있어
앱 초기화를 위해 plist 가 필요합니다(무료).

1. Firebase 콘솔의 같은 프로젝트에 **iOS 앱 추가** → Bundle ID 입력(Xcode 의 것과 동일)
2. `GoogleService-Info.plist` 다운로드 → Xcode 에서 `SecretCall` 타깃에 드래그(“Copy items” 체크)

### 3-4. APNs 키 (서버가 VoIP 푸시 전송)

`docs/PUSH_SETUP.md` §2 참고 — `.p8` 키 발급 후 서버 `.env` 에 설정.
Bundle ID 는 `APNS_BUNDLE_ID` 와 일치해야 하며, 서버는 토픽 `<bundleId>.voip` 로 보냅니다.

---

## ④ PushKit + CallKit 네이티브 연동 (필수)

iOS 13+ 는 **VoIP 푸시를 받으면 즉시 CallKit 에 통화를 보고**하지 않으면 앱을 강제 종료합니다.
`ios/SecretCall/AppDelegate.mm` 에 아래를 추가합니다(라이브러리 iOS README 기준 요약).

상단 import:

```objc
#import <PushKit/PushKit.h>
#import "RNVoipPushNotificationManager.h"
#import "RNCallKeep.h"
```

`didFinishLaunchingWithOptions` 안에서 VoIP 등록:

```objc
[RNVoipPushNotificationManager voipRegistration];
```

`@implementation AppDelegate` 안에 PushKit 델리게이트 추가:

```objc
// VoIP 토큰 수신 → JS 로 전달(서버 등록에 사용)
- (void)pushRegistry:(PKPushRegistry *)registry didUpdatePushCredentials:(PKPushCredentials *)credentials forType:(PKPushType)type {
  [RNVoipPushNotificationManager didUpdatePushCredentials:credentials forType:(NSString *)type];
}

// VoIP 푸시 수신 → 반드시 CallKit 에 즉시 보고
- (void)pushRegistry:(PKPushRegistry *)registry didReceiveIncomingPushWithPayload:(PKPushPayload *)payload forType:(PKPushType)type withCompletionHandler:(void (^)(void))completion {
  NSString *from = payload.dictionaryPayload[@"from"] ?: @"unknown";
  NSString *uuid = [[NSUUID UUID] UUIDString];

  [RNCallKeep reportNewIncomingCall:uuid
                             handle:from
                         handleType:@"generic"
                           hasVideo:NO
                localizedCallerName:from
                    supportsHolding:YES
                       supportsDTMF:NO
                   supportsGrouping:NO
                 supportsUngrouping:NO
                        fromPushKit:YES
                            payload:payload.dictionaryPayload
              withCompletionHandler:completion];

  [RNVoipPushNotificationManager didReceiveIncomingPushWithPayload:payload forType:(NSString *)type];
}
```

> Swift AppDelegate 프로젝트라면 각 라이브러리 README 의 Swift 예제를 따르세요.
> 버전에 따라 `reportNewIncomingCall` 시그니처가 다를 수 있으니 설치된 RNCallKeep 헤더를 확인하세요.

---

## ⑤ 서버 연결

- **시뮬레이터**: `mobile/src/config.ts` 의 `DEV_HOST = 'localhost'` 그대로 동작.
- **실기기(개발)**: iOS 는 `adb reverse` 같은 게 없습니다. `DEV_HOST` 를 **Mac 의 LAN IP**
  (예: `192.168.0.10`)로 바꾸고, 개발 중 평문(http) 접속을 위해 `Info.plist` 에 임시 예외:

```xml
<key>NSAppTransportSecurity</key>
<dict><key>NSAllowsLocalNetworking</key><true/></dict>
```

- **배포**: 서버를 https/wss 도메인으로 올리고 `PROD_HTTP`/`PROD_WS` 교체(예외 불필요).

서버 실행 + 아이디 발급은 `docs/BUILD_ANDROID.md` ④ 와 동일.

---

## ⑥ 실기기 실행

1. `ios/SecretCall.xcworkspace` 를 Xcode 로 열기
2. 타깃 → Signing & Capabilities → **Team** 선택(Apple Developer 계정), Bundle ID 고유하게
3. 상단에서 연결된 iPhone 선택 → ▶︎ Run
   - 또는 터미널: `npx react-native run-ios --device`
4. 아이폰에서 개발자 신뢰(설정 → 일반 → VPN 및 기기 관리)
5. 마이크/알림 권한 허용 → 발급받은 아이디로 가입 → 통화 테스트, 안전번호 확인

---

## ⑦ TestFlight / App Store 배포

1. Xcode → Product → **Archive**
2. Organizer → **Distribute App** → App Store Connect 업로드
3. https://appstoreconnect.apple.com 에서 TestFlight(내부 테스트) 또는 심사 제출
4. 심사 참고: 개인정보 미수집(아이디만)·E2EE 통화 앱임을 설명. 마이크 사용 목적 명시.

---

## 문제 해결

| 증상 | 해결 |
|------|------|
| `pod install` 실패 | `cd ios && pod repo update && pod install`, CocoaPods 최신화 |
| VoIP 푸시 후 앱 강제종료 | ④ 의 CallKit 즉시 보고 누락 — AppDelegate 확인 |
| 서명 오류 | Team 선택, Bundle ID 중복 여부, 프로비저닝 프로파일 |
| 실기기에서 서버 연결 안 됨 | `DEV_HOST` 를 Mac LAN IP 로, ATS 예외 추가, 같은 WiFi |
| 통화 연결 안 됨(벨만 울림) | 방화벽/NAT → TURN 필요 (`docs/DEPLOY.md` ③) |
