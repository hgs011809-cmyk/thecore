import { PermissionsAndroid, Platform } from 'react-native';

/** 통화 전 마이크 권한 확보. iOS 는 Info.plist + 최초 getUserMedia 시 시스템 팝업으로 처리됨. */
export async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: '마이크 권한',
        message: '통화를 위해 마이크 사용 권한이 필요합니다.',
        buttonPositive: '허용',
        buttonNegative: '취소',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}
