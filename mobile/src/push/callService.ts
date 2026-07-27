/**
 * 네이티브 전화 UI(CallKeep) 서비스.
 *
 * - Android: ConnectionService 기반 수신 전화 화면
 * - iOS: CallKit (VoIP 푸시 수신 시 반드시 CallKit 에 통화를 보고해야 함)
 *
 * 푸시가 도착하면 displayIncomingCall() 로 전화 화면을 띄우고,
 * 사용자의 '받기/거절' 을 앱 로직(onAnswer/onDecline)으로 전달한다.
 */
import RNCallKeep from 'react-native-callkeep';
import { Platform } from 'react-native';
import uuid from 'react-native-uuid';

type Handler = (peerId: string) => void;

const options = {
  ios: {
    appName: 'SecretCall',
    supportsVideo: false,
    maximumCallGroups: '1',
    maximumCallsPerCallGroup: '1',
  },
  android: {
    alertTitle: '권한 필요',
    alertDescription: '전화 수신을 위해 권한을 허용해 주세요.',
    cancelButton: '취소',
    okButton: '확인',
    additionalPermissions: [],
    foregroundService: {
      channelId: 'com.secretcall.call',
      channelName: '수신 전화',
      notificationTitle: 'SecretCall 통화 중',
    },
    selfManaged: false,
  },
};

// uuid ↔ peerId 매핑 (CallKeep 은 통화를 uuid 로 식별)
const callByUuid = new Map<string, string>();
const uuidByPeer = new Map<string, string>();

let handlers: { onAnswer?: Handler; onDecline?: Handler } = {};
let started = false;

export const callService = {
  /** 앱 시작 시 1회 설정. 이벤트 리스너 등록. */
  async setup(h: { onAnswer: Handler; onDecline: Handler }) {
    handlers = h;
    if (started) return;
    started = true;
    try {
      await RNCallKeep.setup(options as any);
      RNCallKeep.setAvailable(true);
    } catch (e) {
      console.warn('[callService] setup 실패:', (e as Error).message);
    }

    RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
      const peer = callByUuid.get(callUUID);
      RNCallKeep.setCurrentCallActive(callUUID);
      if (peer) handlers.onAnswer?.(peer);
    });

    RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
      const peer = callByUuid.get(callUUID);
      cleanup(callUUID);
      if (peer) handlers.onDecline?.(peer);
    });
  },

  /** 수신 전화 화면 표시. (푸시 수신 시 호출) */
  displayIncoming(peerId: string): string {
    const id = (uuid.v4 as () => string)();
    callByUuid.set(id, peerId);
    uuidByPeer.set(peerId, id);
    try {
      RNCallKeep.displayIncomingCall(id, peerId, peerId, 'generic', false);
    } catch (e) {
      console.warn('[callService] displayIncoming:', (e as Error).message);
    }
    return id;
  },

  /** 통화가 실제로 연결되었음을 시스템에 알림 */
  markConnected(peerId: string) {
    const id = uuidByPeer.get(peerId);
    if (id) try { RNCallKeep.setCurrentCallActive(id); } catch {}
  },

  /** 전화 UI 종료 (통화 끝/거절/실패 시) */
  endUI(peerId: string) {
    const id = uuidByPeer.get(peerId);
    if (id) {
      try { RNCallKeep.endCall(id); } catch {}
      cleanup(id);
    }
  },

  /** 발신 통화를 시스템에 표시(선택) */
  startOutgoing(peerId: string): string {
    const id = (uuid.v4 as () => string)();
    callByUuid.set(id, peerId);
    uuidByPeer.set(peerId, id);
    if (Platform.OS === 'ios') try { RNCallKeep.startCall(id, peerId, peerId, 'generic', false); } catch {}
    return id;
  },
};

function cleanup(callUUID: string) {
  const peer = callByUuid.get(callUUID);
  callByUuid.delete(callUUID);
  if (peer) uuidByPeer.delete(peer);
}
