/**
 * 푸시 등록 및 수신 처리.
 * - Android: FCM 토큰 등록 + 포그라운드 data 메시지 처리
 * - iOS: PushKit VoIP 토큰 등록 + VoIP 푸시 수신 처리
 *
 * (백그라운드/종료 상태의 Android data 메시지는 index.js 의 headless 핸들러에서 처리)
 */
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
// iOS 전용 모듈. Android 빌드에서 문제되지 않도록 동적 require.
let VoipPushNotification: any = null;
if (Platform.OS === 'ios') {
  VoipPushNotification = require('react-native-voip-push-notification').default;
}
import { registerPushToken } from '../api/rest';
import { callService } from './callService';

let unsubscribers: Array<() => void> = [];

export async function registerForPush(userId: string, authToken: string) {
  disposePush();

  if (Platform.OS === 'android') {
    await messaging().requestPermission();
    const token = await messaging().getToken();
    if (token) await registerPushToken(userId, authToken, 'android', token).catch(() => {});
    unsubscribers.push(
      messaging().onTokenRefresh((t) => {
        registerPushToken(userId, authToken, 'android', t).catch(() => {});
      })
    );
    // 포그라운드 수신
    unsubscribers.push(
      messaging().onMessage(async (msg) => {
        if (msg.data?.type === 'incoming_call' && msg.data?.from) {
          callService.displayIncoming(String(msg.data.from));
        }
      })
    );
  } else if (VoipPushNotification) {
    VoipPushNotification.registerVoipToken();
    const onReg = (token: string) => {
      registerPushToken(userId, authToken, 'ios', token).catch(() => {});
    };
    const onNotif = (notification: any) => {
      const from = notification?.from;
      if (from) callService.displayIncoming(String(from));
    };
    VoipPushNotification.addEventListener('register', onReg);
    VoipPushNotification.addEventListener('notification', onNotif);
    unsubscribers.push(() => {
      VoipPushNotification.removeEventListener('register');
      VoipPushNotification.removeEventListener('notification');
    });
  }
}

export function disposePush() {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
}
