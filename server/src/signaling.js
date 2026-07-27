import { WebSocketServer } from 'ws';
import { authenticate } from './auth.js';
import { q } from './db.js';
import { sendIncomingCallPush } from './push.js';
import { config } from './config.js';

/**
 * 시그널링 서버.
 *
 * 서버는 통화 신호(SDP/ICE)만 상대에게 "그대로 전달"할 뿐,
 * 음성 미디어는 절대 서버를 지나지 않는다(WebRTC P2P).
 * SDP 안의 DTLS 지문은 발신자의 신원키로 서명되어 있어,
 * 서버가 내용을 바꿔치기하면 수신자 검증에서 걸린다.
 */

// 클라이언트가 상대에게 중계를 요청할 수 있는 메시지 타입.
const RELAY_TYPES = new Set([
  'call-offer', // 발신: { to, sdp, sig, from_pubkey }
  'call-answer', // 응답: { to, sdp, sig }
  'ice-candidate', // 양방향: { to, candidate }
  'call-reject', // 수신자가 거절: { to, reason }
  'call-hangup', // 통화 종료: { to }
  'call-cancel', // 발신자가 취소: { to }
]);

const MAX_MESSAGE_BYTES = 64 * 1024;

export function attachSignaling(server) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MESSAGE_BYTES });

  /** @type {Map<string, import('ws').WebSocket>} 온라인 사용자 */
  const online = new Map();

  /** @type {Map<string, {payload: object, timer: NodeJS.Timeout}>} 오프라인 상대에게 버퍼된 통화 offer */
  const pending = new Map();

  function send(ws, obj) {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  }

  function clearPending(to) {
    const p = pending.get(to);
    if (p) {
      clearTimeout(p.timer);
      pending.delete(to);
    }
  }

  function bufferPending(to, payload) {
    clearPending(to);
    const timer = setTimeout(() => pending.delete(to), config.pendingCallTtlMs);
    pending.set(to, { payload, timer });
  }

  function flushPending(userId, ws) {
    const p = pending.get(userId);
    if (!p) return;
    clearPending(userId);
    send(ws, p.payload); // 깨어난 수신자에게 버퍼된 call-offer 전달
  }

  function hasPushToken(userId) {
    const u = q.getUser.get(userId);
    return !!(u && u.push && (u.push.fcm || u.push.apnsVoip));
  }

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.userId = null;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return send(ws, { type: 'error', error: 'JSON 형식 오류' });
      }
      if (!msg || typeof msg.type !== 'string') {
        return send(ws, { type: 'error', error: 'type 필드 필요' });
      }

      // 1) 인증
      if (msg.type === 'auth') {
        const user = authenticate(msg.user_id, msg.auth_token);
        if (!user) {
          send(ws, { type: 'auth-fail' });
          return ws.close(4001, 'auth-fail');
        }
        // 같은 아이디로 기존 연결이 있으면 교체(마지막 기기 우선)
        const prev = online.get(user.user_id);
        if (prev && prev !== ws) prev.close(4002, 'replaced');
        ws.userId = user.user_id;
        online.set(user.user_id, ws);
        send(ws, { type: 'auth-ok', user_id: user.user_id });
        // 깨어난 직후 대기 중인 통화가 있으면 바로 전달
        flushPending(user.user_id, ws);
        return;
      }

      // 인증 전에는 다른 메시지 불가
      if (!ws.userId) {
        return send(ws, { type: 'error', error: '먼저 인증하세요.' });
      }

      // 2) 중계 메시지
      if (RELAY_TYPES.has(msg.type)) {
        const to = msg.to;
        if (typeof to !== 'string' || !to) {
          return send(ws, { type: 'error', error: 'to 필드 필요' });
        }
        // 발신자 표시를 서버가 확정(스푸핑 방지)
        const { to: _omit, ...rest } = msg;
        const payload = { ...rest, from: ws.userId };

        const target = online.get(to);
        if (target) {
          return send(target, payload);
        }

        // 상대가 오프라인인 경우
        if (msg.type === 'call-offer') {
          // offer 를 잠시 버퍼링하고 푸시로 상대를 깨운다
          bufferPending(to, payload);
          if (hasPushToken(to)) {
            const user = q.getUser.get(to);
            sendIncomingCallPush(user, ws.userId).catch((e) =>
              console.warn('[push]', e?.message)
            );
            return send(ws, { type: 'ringing', to }); // 상대를 깨우는 중
          }
          return send(ws, { type: 'peer-offline', to });
        }
        if (msg.type === 'call-cancel') {
          clearPending(to); // 발신자가 취소하면 대기 중 offer 제거
        }
        return send(ws, { type: 'peer-offline', to });
      }

      send(ws, { type: 'error', error: `알 수 없는 타입: ${msg.type}` });
    });

    ws.on('close', () => {
      if (ws.userId && online.get(ws.userId) === ws) {
        online.delete(ws.userId);
      }
    });
  });

  // 죽은 연결 정리 (30초 하트비트)
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        /* noop */
      }
    }
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  return { wss, online };
}
