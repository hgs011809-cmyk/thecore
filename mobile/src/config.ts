/**
 * 서버 주소 설정.
 *
 * ── 개발(디버그) ──
 * 아래 DEV_HOST 를 환경에 맞게 고르세요:
 *   • 안드로이드 에뮬레이터        → '10.0.2.2'   (에뮬레이터에서 PC 를 가리키는 특수 IP)
 *   • 실기기(USB) + `adb reverse`  → 'localhost'  (아래 가이드 참고, 가장 간단)
 *   • 실기기(같은 WiFi)            → 'PC의 LAN IP' (예: '192.168.0.10')
 *
 *   ▶ USB 실기기 추천: 빌드 전 한 번만
 *        adb reverse tcp:8080 tcp:8080
 *     그러면 폰의 localhost:8080 이 PC 의 서버로 연결됩니다. (DEV_HOST = 'localhost')
 *
 * ── 배포(릴리스) ──
 * PROD_HTTP / PROD_WS 를 실제 도메인(https/wss)으로 교체하세요.
 */

// 필요에 맞게 이 한 줄만 바꾸면 됩니다.
//   에뮬레이터: '10.0.2.2' / USB 실기기(adb reverse): 'localhost' / 같은 WiFi: PC LAN IP
const DEV_HOST = 'localhost';

// 배포 시 아래 두 값을 실제 서버로 교체하세요.
const PROD_HTTP = 'https://your-server.example.com';
const PROD_WS = 'wss://your-server.example.com/ws';

export const IS_DEV = __DEV__;

export const API_BASE = IS_DEV ? `http://${DEV_HOST}:8080` : PROD_HTTP;
export const WS_URL = IS_DEV ? `ws://${DEV_HOST}:8080/ws` : PROD_WS;
