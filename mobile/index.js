/**
 * 앱 진입점.
 * - tweetnacl 이 안전한 난수를 쓰도록 폴리필을 가장 먼저 로드
 * - FCM 백그라운드/종료 상태 메시지 핸들러 등록(반드시 컴포넌트 밖, 최상위에서)
 */
import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';
import { callService } from './src/push/callService';

// 앱이 백그라운드/종료 상태일 때 도착한 통화 푸시 → 네이티브 전화 화면 표시.
// Firebase(google-services.json) 미설정 환경에서도 앱이 죽지 않도록 방어한다.
try {
  messaging().setBackgroundMessageHandler(async (msg) => {
    if (msg.data?.type === 'incoming_call' && msg.data?.from) {
      callService.displayIncoming(String(msg.data.from));
    }
  });
} catch (e) {
  console.warn('[fcm] 백그라운드 핸들러 등록 건너뜀:', e?.message);
}

AppRegistry.registerComponent(appName, () => App);
