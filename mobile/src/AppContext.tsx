/**
 * 앱 전역 상태: 세션(신원/토큰), 시그널링 연결, 통화 관리자.
 */
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { SignalingClient } from './signaling/SignalingClient';
import { CallManager, CallInfo } from './webrtc/CallManager';
import { fetchIceServers, fetchPeerPublicKey, RTCIceServerLike } from './api/rest';
import { loadPublicInfo, loadSecrets, clearSession } from './storage/secureStore';
import { registerForPush, disposePush } from './push/pushClient';
import { callService } from './push/callService';

interface Session {
  userId: string;
  publicKey: string;
}

interface AppState {
  ready: boolean;
  session: Session | null;
  connected: boolean;
  call: CallInfo;
  refreshSession: () => Promise<void>;
  startCall: (peerId: string) => Promise<void>;
  acceptCall: () => void;
  rejectCall: () => void;
  hangup: () => void;
  toggleMute: () => void;
  getManager: () => CallManager | null;
  logout: () => Promise<void>;
}

const IDLE: CallInfo = { peerId: '', state: 'idle', isMuted: false };
const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [connected, setConnected] = useState(false);
  const [call, setCall] = useState<CallInfo>(IDLE);

  const signalingRef = useRef<SignalingClient | null>(null);
  const managerRef = useRef<CallManager | null>(null);
  // 앱이 아직 준비되기 전 잠금화면에서 '받기'를 누른 경우 보관
  const pendingAnswerPeerRef = useRef<string | null>(null);

  const teardown = useCallback(() => {
    managerRef.current?.dispose();
    signalingRef.current?.close();
    disposePush();
    managerRef.current = null;
    signalingRef.current = null;
    setConnected(false);
    setCall(IDLE);
  }, []);

  // manager 의 상태 변화를 화면 + 네이티브 전화 UI 에 동기화
  const handleCallChange = useCallback((ci: CallInfo) => {
    setCall(ci);
    try {
      if (ci.state === 'connected') callService.markConnected(ci.peerId);
      else if (ci.state === 'ended' || ci.state === 'failed') callService.endUI(ci.peerId);
    } catch {
      /* 네이티브 미설정 환경 무시 */
    }
  }, []);

  const connect = useCallback(async () => {
    const info = await loadPublicInfo();
    const secrets = await loadSecrets();
    if (!info || !secrets) {
      setSession(null);
      return;
    }
    setSession(info);

    const signaling = new SignalingClient(info.userId, secrets.authToken);
    await signaling.connect();
    signalingRef.current = signaling;
    setConnected(true);

    // 초기 1회 조회(폴백용). 실제 통화 직전엔 provider 가 최신 임시 자격증명을 다시 받아온다.
    let cachedIce: RTCIceServerLike[] = await fetchIceServers(info.userId, secrets.authToken).catch(
      () => []
    );
    const getIceServers = async () => {
      try {
        cachedIce = await fetchIceServers(info.userId, secrets.authToken);
      } catch {
        /* 실패 시 마지막 성공값 사용 */
      }
      return cachedIce;
    };

    managerRef.current = new CallManager(
      signaling,
      { userId: info.userId, publicKey: info.publicKey, secretKey: secrets.secretKey },
      getIceServers,
      (peerId) => fetchPeerPublicKey(info.userId, secrets.authToken, peerId),
      handleCallChange
    );

    // 잠금화면에서 이미 '받기'를 누른 통화가 있으면 자동 수락 무장
    if (pendingAnswerPeerRef.current) {
      managerRef.current.armAutoAccept(pendingAnswerPeerRef.current);
      pendingAnswerPeerRef.current = null;
    }

    // 수신 알림용 푸시 토큰 등록 (실패해도 통화 자체엔 영향 없음)
    registerForPush(info.userId, secrets.authToken).catch((e) =>
      console.warn('푸시 등록 실패:', e?.message)
    );
  }, [handleCallChange]);

  const refreshSession = useCallback(async () => {
    teardown();
    await connect().catch((e) => console.warn('연결 실패:', e?.message));
  }, [connect, teardown]);

  // 네이티브 전화 UI(CallKeep) 이벤트 → 앱 로직 연결 (앱 시작 시 1회)
  useEffect(() => {
    callService.setup({
      onAnswer: async (peerId) => {
        if (managerRef.current) {
          managerRef.current.armAutoAccept(peerId);
        } else {
          // 종료 상태에서 깨어난 경우: 연결 후 자동 수락되도록 예약
          pendingAnswerPeerRef.current = peerId;
          await connect().catch((e) => console.warn('answer 연결 실패:', e?.message));
        }
      },
      onDecline: async (peerId) => {
        if (!signalingRef.current) {
          await connect().catch(() => {});
        }
        signalingRef.current?.signal({ type: 'call-reject', to: peerId, reason: 'declined' });
        managerRef.current?.hangup();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      await connect().catch((e) => console.warn('초기 연결 실패:', e?.message));
      setReady(true);
    })();
    return teardown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AppState = {
    ready,
    session,
    connected,
    call,
    refreshSession,
    startCall: async (peerId) => {
      if (!managerRef.current) throw new Error('서버에 연결되지 않았습니다.');
      await managerRef.current.startCall(peerId.trim());
    },
    acceptCall: () => managerRef.current?.acceptCall(),
    rejectCall: () => managerRef.current?.rejectCall(),
    hangup: () => managerRef.current?.hangup(),
    toggleMute: () => managerRef.current?.toggleMute(),
    getManager: () => managerRef.current,
    logout: async () => {
      teardown();
      await clearSession();
      setSession(null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider 안에서 사용하세요.');
  return v;
}
