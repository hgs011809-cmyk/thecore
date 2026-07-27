/**
 * 시그널링 WebSocket 클라이언트.
 * 서버와 통화 신호(offer/answer/ICE)를 주고받는다. 음성은 여기로 다니지 않는다.
 */
import { WS_URL } from '../config';

export type SignalMessage =
  | { type: 'auth-ok'; user_id: string }
  | { type: 'auth-fail' }
  | { type: 'peer-offline'; to: string }
  | { type: 'ringing'; to: string } // 상대를 푸시로 깨우는 중
  | { type: 'error'; error: string }
  | { type: 'call-offer'; from: string; sdp: string; sig: string; from_pubkey: string }
  | { type: 'call-answer'; from: string; sdp: string; sig: string }
  | { type: 'ice-candidate'; from: string; candidate: any }
  | { type: 'call-reject'; from: string; reason?: string }
  | { type: 'call-hangup'; from: string }
  | { type: 'call-cancel'; from: string };

type Listener = (msg: SignalMessage) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private authed = false;
  private queue: object[] = [];

  constructor(
    private userId: string,
    private authToken: string
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.send({ type: 'auth', user_id: this.userId, auth_token: this.authToken });
      };
      this.ws.onmessage = (ev) => {
        let msg: SignalMessage;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (msg.type === 'auth-ok') {
          this.authed = true;
          this.flushQueue();
          resolve();
          return;
        }
        if (msg.type === 'auth-fail') {
          reject(new Error('시그널링 인증 실패'));
          return;
        }
        this.emit(msg);
      };
      this.ws.onerror = () => {
        if (!this.authed) reject(new Error('시그널링 서버 연결 실패'));
      };
      this.ws.onclose = () => {
        this.authed = false;
      };
    });
  }

  private flushQueue() {
    for (const m of this.queue) this.rawSend(m);
    this.queue = [];
  }

  private rawSend(obj: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  /** 인증 메시지 등 즉시 전송 */
  private send(obj: object) {
    this.rawSend(obj);
  }

  /** 인증 이후에만 나가는 신호 (인증 전이면 큐잉) */
  signal(obj: object) {
    if (this.authed) this.rawSend(obj);
    else this.queue.push(obj);
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(msg: SignalMessage) {
    for (const fn of this.listeners) fn(msg);
  }

  close() {
    this.ws?.close();
    this.ws = null;
    this.authed = false;
  }
}
