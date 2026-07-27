# 가장 빠른 배포 — Render 무료 (테스트용)

최종본 전, **폰에서 통화되는 걸 가장 빨리 확인**하는 경로입니다.
무거운 것(오라클 VM, coturn 직접설치, iOS)은 빼고, 공개 URL 무료 서버 + 무료 공개 TURN +
안드로이드 APK 로 갑니다.

> 요약 흐름: **① 코드 GitHub 올리기 → ② Render 원클릭 배포 → ③ Firebase 5분 →
> ④ 앱에 서버주소 넣고 APK 빌드 → ⑤ 폰 2대에 설치 후 통화**
> 예상 시간: 처음이면 40~60분(대부분 계정 만들기/빌드 도구 설치).

---

## ① 코드 GitHub 올리기

Render 는 GitHub 저장소를 연결해 배포합니다.

```powershell
# 프로젝트 루트(클로드 폴더)에서
git init
git add .
git commit -m "SecretCall initial"
```
- https://github.com 에서 새 저장소 생성(비공개 가능) → 안내된 `git remote add` / `git push` 실행.

> 이미 `render.yaml`(배포 청사진)과 `server/.gitignore`(secrets·data 제외)가 들어 있습니다.

## ② Render 배포 (원클릭에 가까움)

1. https://render.com 가입(무료, GitHub 로 로그인 편함)
2. 대시보드 → **New +** → **Blueprint** → 방금 올린 저장소 선택
3. `render.yaml` 을 자동 인식 → **Apply**. 서버가 생성/배포됩니다.
4. 배포 완료 후 주소 확인: `https://secretcall-signaling-XXXX.onrender.com`
   - 브라우저로 `그주소/api/health` → `{"ok":true}` 나오면 성공
5. 이 주소를 메모해 둡니다. (앱에 넣을 것)

블루프린트에 **테스트 계정이 미리 심어져** 있습니다(재시작해도 유지):
- 아이디 `phoneA` / 등록코드 `111111`
- 아이디 `phoneB` / 등록코드 `222222`
- TURN 은 무료 공개 서버(OpenRelay)가 기본 설정됨

> ⚠️ 무료 플랜은 15분 유휴 시 잠들어 첫 요청이 느릴 수 있고(정상), 파일 저장소가
> 초기화됩니다. 그래서 위 시드 계정을 쓰는 것 — 초기화돼도 계정은 되살아납니다.
> (`admin-cli` 로 새 아이디를 발급해도 되지만, 재시작 시 사라지니 테스트엔 시드 권장)

## ③ Firebase 5분 (안드로이드 빌드에 필요)

앱이 FCM 을 포함하므로 빌드하려면 `google-services.json` 이 필요합니다(무료).

1. https://console.firebase.google.com → 프로젝트 생성
2. Android 앱 추가 → 패키지명 입력(예: `com.secretcall`, 아래 ④와 동일해야 함)
3. `google-services.json` 다운로드 → `mobile/android/app/` 에 저장
4. (선택) 앱이 꺼져도 전화 오게 하려면 서버 FCM 키까지 → `docs/PUSH_SETUP.md`
   - 지금 첫 테스트는 **두 폰 모두 앱을 켠 상태**면 이 단계 없이도 통화됩니다.

## ④ 앱에 서버주소 넣고 APK 빌드

`mobile/src/config.ts` 상단의 배포 주소를 Render 주소로 교체:

```ts
const PROD_HTTP = 'https://secretcall-signaling-XXXX.onrender.com';
const PROD_WS   = 'wss://secretcall-signaling-XXXX.onrender.com/ws';
```

그다음 `docs/BUILD_ANDROID.md` 를 따라 안드로이드 프로젝트를 만들고 **릴리스 APK** 빌드:
- ②(네이티브 프로젝트 생성) → ③(권한/CallKeep/Firebase 설정) → ⑥(APK 빌드)
- 릴리스 빌드는 `__DEV__=false` 라 위 PROD 주소(https/wss)로 접속합니다.

> 릴리스 APK 는 배포 서버(https)로 붙으므로 평문 예외 설정이 필요 없습니다.

## ⑤ 폰 2대에 설치 후 통화

1. APK 를 두 안드로이드 폰에 설치(사이드로드: "출처 불명 앱 설치" 허용)
2. 폰1: 아이디 `phoneA` + 코드 `111111` 로 가입 / 폰2: `phoneB` + `222222`
3. 두 폰 다 앱을 켠 상태에서, 한쪽이 상대 아이디 입력 → 통화
4. 연결되면 양쪽 화면의 **안전번호가 같은지** 확인 (E2EE 정상)

---

## 잘 안될 때

| 증상 | 확인 |
|------|------|
| `/api/health` 안 열림 | Render 대시보드 로그, 배포 성공 여부. 첫 접속은 잠깨우기로 느림 |
| 가입 실패(404/401) | 아이디/코드 정확히(phoneA/111111), Render 로그의 `[seed]` 라인 |
| 통화 벨은 울리는데 연결 안 됨 | TURN 문제 — OpenRelay 값 최신 여부, 또는 자체 TURN(`docs/DEPLOY.md`) |
| 빌드 실패(google-services) | ③ 완료 여부, 패키지명 일치 |
| 소리 안 남 | 두 폰 마이크 권한 허용 + 상태가 '통화중(connected)' |

## 이 방식의 한계 (알고 쓰기)

- 무료 Render 는 유휴 시 잠들고 저장소가 초기화됩니다 → **테스트/시연용**.
- 실제 회원 운영(데이터 유지, 상시 가동, TURN 대역폭)은 오라클 무료 VM(`docs/DEPLOY_FREE.md`
  경로 A) 또는 유료 VPS(`docs/DEPLOY.md`)로 옮기는 걸 권장합니다.
- iOS 는 Apple 개발자 $99/년 필요 — 지금은 안드로이드만.
