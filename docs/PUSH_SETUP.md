# 백그라운드 수신 알림 설정 (FCM + APNs)

앱이 꺼져 있어도 전화가 오게 하려면 아래를 설정합니다. 코드는 이미 구현돼 있고,
여기서는 **외부 서비스 키 발급 + 네이티브 설정**만 하면 됩니다.

동작 흐름:
```
발신자 → 서버(오프라인 감지) → 푸시(FCM/APNs) → 수신자 기기 깨움
      → CallKeep/CallKit 전화 화면 → '받기' → 앱이 서버 접속
      → 서버가 버퍼했던 통화 offer 전달 → 자동 수락 → 통화 연결
```

---

## 1. Android (FCM)

### 1-1. Firebase 프로젝트
1. https://console.firebase.google.com 에서 프로젝트 생성
2. Android 앱 추가 → 패키지명(예: `com.secretcall`) 입력
3. `google-services.json` 다운로드 → `mobile/android/app/` 에 넣기
4. 프로젝트 설정 → 서비스 계정 → **새 비공개 키 생성** → JSON 다운로드
   → 서버의 `server/secrets/fcm-service-account.json` 로 저장

### 1-2. 서버 `.env`
```
FCM_PROJECT_ID=<Firebase 프로젝트 ID>
FCM_SERVICE_ACCOUNT_FILE=./secrets/fcm-service-account.json
```

### 1-3. Android 네이티브 설정
`android/build.gradle` (project):
```gradle
buildscript { dependencies { classpath 'com.google.gms:google-services:4.4.2' } }
```
`android/app/build.gradle` 맨 아래:
```gradle
apply plugin: 'com.google.gms.google-services'
```
`android/app/src/main/AndroidManifest.xml` — CallKeep(ConnectionService) 권한/서비스:
```xml
<uses-permission android:name="android.permission.BIND_TELECOM_CONNECTION_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL"/>
<uses-permission android:name="android.permission.MANAGE_OWN_CALLS"/>

<application ...>
  <service
    android:name="io.wazo.callkeep.VoiceConnectionService"
    android:label="SecretCall"
    android:permission="android.permission.BIND_TELECOM_CONNECTION_SERVICE"
    android:foregroundServiceType="phoneCall"
    android:exported="true">
    <intent-filter>
      <action android:name="android.telecom.ConnectionService" />
    </intent-filter>
  </service>
</application>
```

---

## 2. iOS (APNs VoIP 푸시 + CallKit)

### 2-1. APNs 키
1. Apple Developer → Certificates, Identifiers & Profiles → Keys → **+**
2. **Apple Push Notifications service (APNs)** 체크 → 생성 → `AuthKey_XXXX.p8` 다운로드
   → 서버의 `server/secrets/AuthKey_XXXX.p8` 로 저장
3. App ID 의 Capabilities 에서 **Push Notifications** 활성화

### 2-2. 서버 `.env`
```
APNS_KEY_FILE=./secrets/AuthKey_XXXX.p8
APNS_KEY_ID=<키 ID (10자리)>
APNS_TEAM_ID=<팀 ID (10자리)>
APNS_BUNDLE_ID=com.secretcall
APNS_PRODUCTION=false      # TestFlight/스토어 배포 시 true
```
> 서버는 VoIP 토픽 `com.secretcall.voip` 로 전송합니다(코드에서 `.voip` 자동 부가).

### 2-3. Xcode 설정
- Signing & Capabilities 에 추가: **Push Notifications**, **Background Modes**
  → *Voice over IP*, *Remote notifications*, *Background fetch* 체크
- `ios/Podfile` 에서 `pod install` (firebase, callkeep, voip-push 자동 링크)
- `AppDelegate.mm` 에 PushKit + CallKit 연동 코드 추가
  (react-native-voip-push-notification, react-native-callkeep README 의 iOS 예제 참고):
  - `PKPushRegistry` 등록 → 토큰을 `RNVoipPushNotificationManager` 로 전달
  - `didReceiveIncomingPushWith` 에서 **즉시** `RNCallKeep reportNewIncomingCall` 호출
    (iOS 13+ 는 VoIP 푸시 수신 시 반드시 CallKit 통화 보고 필요, 안 하면 앱이 강제 종료됨)

---

## 3. 동작 확인

1. 서버에 FCM/APNs 설정 후 재시작 → 로그에 푸시 관련 경고 없어야 함
2. 기기 A, B 로 로그인(앱이 자동으로 푸시 토큰 등록: `POST /api/push-token`)
3. B 앱을 완전히 종료 → A 에서 B 에게 전화
4. B 기기에 전화 화면이 떠야 함 → '받기' → 통화 연결

## 4. 문제 해결

- **Android 종료 상태에서 안 뜸:** 배터리 최적화 예외 필요할 수 있음. 고우선순위
  data 메시지가 오는지 `adb logcat` 확인.
- **iOS 앱이 죽음:** VoIP 푸시 수신 즉시 CallKit 보고를 안 한 경우. AppDelegate 확인.
- **토큰 미등록:** 로그인 직후 네트워크/권한 확인. `registerForPush` 경고 로그 확인.
