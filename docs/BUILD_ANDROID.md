# 안드로이드 실기기 빌드 가이드 (Windows 기준)

내 안드로이드 폰에 SecretCall 앱을 설치해 실제로 통화까지 확인하는 전체 절차입니다.
크게 **① 준비 → ② 네이티브 프로젝트 생성 → ③ 안드로이드 설정 → ④ 서버 연결 →
⑤ 개발 빌드로 실행 → ⑥ 배포용 APK** 순서입니다.

> 이 저장소의 `mobile/` 에는 JS 소스만 있습니다. 플랫폼 빌드 폴더(`android/`)는
> React Native CLI 로 한 번 생성해서 얹어야 합니다(아래 ②).

---

## ① 준비물 설치

1. **Node.js 18+** — https://nodejs.org (LTS)
2. **JDK 17** — Temurin 17 (https://adoptium.net). 설치 후 환경변수 `JAVA_HOME` 설정
3. **Android Studio** — https://developer.android.com/studio
   - 설치 시 **Android SDK**, **Android SDK Platform-Tools**, **하나 이상의 SDK Platform(API 34 권장)** 체크
   - 환경변수 `ANDROID_HOME` = `C:\Users\<사용자>\AppData\Local\Android\Sdk`
   - `Path` 에 추가: `%ANDROID_HOME%\platform-tools`
4. **폰 USB 디버깅 켜기**
   - 설정 → 휴대전화 정보 → 빌드번호 7번 탭 (개발자 옵션 활성화)
   - 개발자 옵션 → **USB 디버깅** 켜기 → PC 에 USB 연결 → 폰에서 "허용"
   - 확인: PowerShell 에서 `adb devices` → 기기 목록에 뜨면 성공

> 설치 점검: `node -v`, `java -version`, `adb version` 이 모두 정상 출력돼야 합니다.

---

## ② 네이티브 프로젝트 생성 후 소스 얹기

임시 프로젝트를 같은 RN 버전으로 만들고, 거기서 `android/` 폴더만 가져옵니다.

```powershell
# 작업 폴더에서 (경로에 한글이 없는 곳 권장)
npx @react-native-community/cli@latest init SecretCall --version 0.75.4
```

생성된 `SecretCall\android` 폴더를 이 저장소의 `mobile\android` 로 복사합니다.
그런 다음 `mobile\` 에서:

```powershell
cd mobile
npm install
```

> 대안: 생성된 `SecretCall` 프로젝트를 그대로 쓰고, 이 저장소의 `src\`, `App.tsx`,
> `index.js`, 그리고 `package.json` 의 dependencies 를 그쪽으로 병합해도 됩니다.

---

## ③ 안드로이드 네이티브 설정

### 3-1. 권한 + CallKeep 서비스 — `android/app/src/main/AndroidManifest.xml`

`<manifest>` 안, `<application>` 위에 권한 추가:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />
<uses-permission android:name="android.permission.MANAGE_OWN_CALLS" />
<uses-permission android:name="android.permission.BIND_TELECOM_CONNECTION_SERVICE" />
```

`<application>` 안에 CallKeep 의 ConnectionService 추가:

```xml
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
```

### 3-2. `android/app/build.gradle`

`android { defaultConfig { ... } }` 안에서 minSdk 를 24 이상으로:

```gradle
minSdkVersion 24
```

파일 **맨 아래**에 Firebase 플러그인 적용(③-4 에서 사용):

```gradle
apply plugin: 'com.google.gms.google-services'
```

### 3-3. `android/build.gradle` (프로젝트 레벨)

`buildscript { dependencies { ... } }` 에 추가:

```gradle
classpath 'com.google.gms:google-services:4.4.2'
```

### 3-4. Firebase(google-services.json) — 안드로이드 빌드에 필수

우리 앱은 수신 알림(FCM)을 포함하므로, 빌드하려면 `google-services.json` 이 필요합니다(무료).

1. https://console.firebase.google.com → 프로젝트 생성
2. Android 앱 추가 → **패키지명**을 `android/app/build.gradle` 의 `applicationId` 와 동일하게 입력
   (기본값 예: `com.secretcall`)
3. `google-services.json` 다운로드 → `android/app/` 에 저장
4. (선택) 종료 상태 수신 알림까지 확인하려면 `docs/PUSH_SETUP.md` 의 서버 FCM 설정도 진행

> 첫 통화 테스트는 두 폰 모두 앱을 켠 상태(포그라운드)면 푸시 없이도 됩니다.
> Firebase 는 여기서는 "빌드가 되게 하는" 용도이고, 실제 깨우기는 위 4번까지 해야 동작합니다.

---

## ④ 서버 연결 (USB, 가장 간단)

폰의 `localhost` 를 PC 서버로 잇습니다(`mobile/src/config.ts` 기본값이 `localhost`):

```powershell
adb reverse tcp:8080 tcp:8080
```

그리고 서버 실행(별도 터미널, 경로에 한글 없는 곳에서):

```powershell
cd server
npm install
# .env 없으면 만들고 ADMIN_KEY 를 긴 랜덤 문자열로
npm start
```

아이디 두 개 발급:

```powershell
node admin-cli.js issue phoneA
node admin-cli.js issue phoneB   # 각 등록코드를 메모
```

> WiFi 로 붙이려면 `adb reverse` 대신 `config.ts` 의 DEV_HOST 를 PC 의 LAN IP 로 바꾸고
> Windows 방화벽에서 8080 포트를 허용하세요.

---

## ⑤ 개발 빌드로 실기기 실행

폰을 USB 로 연결한 상태에서 `mobile/` 에서:

```powershell
npx react-native run-android
```

- Metro 번들러가 뜨고, 앱이 폰에 설치·실행됩니다.
- 처음 실행 시 마이크/알림 권한을 허용하세요.
- 가입 화면에서 발급받은 `phoneA` + 등록코드로 가입 → 홈 화면.

두 번째 폰(또는 같은 폰에 재설치)으로 `phoneB` 가입 후, 한쪽에서 상대 아이디를
입력해 통화 → 연결되면 화면의 **안전번호**가 양쪽 동일한지 확인하세요.

> 디버그 빌드는 `localhost`/`10.0.2.2` 로의 평문(http/ws) 접속이 허용되어 있어
> `adb reverse` + 로컬 서버로 바로 테스트됩니다.

---

## ⑥ 배포용 APK 빌드 (독립 설치)

Metro 없이 혼자 도는 설치 파일을 만듭니다. 먼저 배포 서버가 있어야 하며,
`mobile/src/config.ts` 의 `PROD_HTTP`/`PROD_WS` 를 실제 도메인(https/wss)으로 바꾸세요.

### 6-1. 서명 키(keystore) 생성

```powershell
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore secretcall.keystore -alias secretcall -keyalg RSA -keysize 2048 -validity 10000
# 비밀번호와 정보를 입력. secretcall.keystore 파일 생성됨 (분실 주의!)
```

### 6-2. `android/gradle.properties` 에 서명 정보 추가

```properties
SECRETCALL_UPLOAD_STORE_FILE=secretcall.keystore
SECRETCALL_UPLOAD_KEY_ALIAS=secretcall
SECRETCALL_UPLOAD_STORE_PASSWORD=<위에서 정한 비번>
SECRETCALL_UPLOAD_KEY_PASSWORD=<위에서 정한 비번>
```

### 6-3. `android/app/build.gradle` 서명 설정

`android { }` 안에 추가:

```gradle
signingConfigs {
    release {
        storeFile file(SECRETCALL_UPLOAD_STORE_FILE)
        storePassword SECRETCALL_UPLOAD_STORE_PASSWORD
        keyAlias SECRETCALL_UPLOAD_KEY_ALIAS
        keyPassword SECRETCALL_UPLOAD_KEY_PASSWORD
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
    }
}
```

### 6-4. APK 빌드 & 설치

```powershell
cd android
./gradlew.bat assembleRelease
# 결과물: android/app/build/outputs/apk/release/app-release.apk
adb install -r app/build/outputs/apk/release/app-release.apk
```

> Play 스토어 업로드는 APK 대신 `./gradlew.bat bundleRelease` 로 만든 `.aab` 를 사용합니다.

---

## 문제 해결

| 증상 | 해결 |
|------|------|
| `adb devices` 에 기기 안 뜸 | USB 디버깅/드라이버 확인, 케이블 교체, 폰의 "허용" 팝업 |
| 빌드 실패: google-services.json | ③-4 완료 여부, 패키지명 일치 확인 |
| 앱은 켜지는데 서버 연결 안 됨 | `adb reverse tcp:8080 tcp:8080` 재실행, 서버 실행 여부 |
| 통화 연결이 안 됨(벨은 울림) | 방화벽/NAT — TURN 서버 필요 (`docs/DEPLOY.md` ③) |
| 마이크 권한 거부됨 | 설정 → 앱 → SecretCall → 권한에서 마이크 허용 |
| 소리 안 들림 | 두 폰 모두 마이크 권한 허용 + 통화 연결(connected) 상태 확인 |

## 참고: 실기기 통화가 실제로 되려면

- **같은 WiFi/네트워크**끼리는 STUN 만으로 대부분 연결됩니다.
- **서로 다른 망(LTE↔WiFi 등)** 이거나 엄격한 방화벽이면 **TURN 서버**가 있어야
  안정적으로 연결됩니다 → `docs/DEPLOY.md` 의 coturn 배포 참고.
- 로컬 개발 서버(`adb reverse`)로는 같은 PC-폰 구간만 테스트됩니다. 두 폰이 서로 다른
  곳에서 통화하려면 **공인 도메인의 배포 서버**가 필요합니다.
