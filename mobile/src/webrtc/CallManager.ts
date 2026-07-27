/**
 * 통화 관리자 — WebRTC 음성통화의 핵심.
 *
 * 음성은 두 기기 사이 P2P(DTLS-SRTP)로만 흐른다. 서버는 신호만 중계한다.
 * offer/answer SDP(DTLS 지문 포함)를 신원키로 서명·검증하여 중간자 공격을 막고,
 * 안전번호로 최종 확인한다.
 */
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { SignalingClient, SignalMessage } from '../signaling/SignalingClient';
import { sign, verify, safetyNumber } from '../crypto/identity';
import { RTCIceServerLike } from '../api/rest';
import { ensureMicPermission } from '../permissions';

export type CallState =
  | 'idle'
  | 'outgoing' // 발신 중(상대 벨 울림)
  | 'incoming' // 수신 중(내 벨 울림)
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'failed';

export interface CallInfo {
  peerId: string;
  state: CallState;
  safetyNumber?: string;
  isMuted: boolean;
  error?: string;
}

interface Identity {
  userId: string;
  publicKey: string;
  secretKey: string;
}

type ResolvePeerKey = (peerId: string) => Promise<string>;

export class CallManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingCandidates: any[] = [];
  private remoteDescSet = false;
  private peerId: string | null = null;
  private peerPublicKey: string | null = null;
  private pendingOffer: Extract<SignalMessage, { type: 'call-offer' }> | null = null;
  private autoAcceptPeer: string | null = null; // 잠금화면/푸시에서 이미 '받기'를 누른 상대
  private unsub: (() => void) | null = null;

  private info: CallInfo = { peerId: '', state: 'idle', isMuted: false };

  constructor(
    private signaling: SignalingClient,
    private identity: Identity,
    // 통화 직전 최신 ICE 서버(임시 TURN 자격증명 포함)를 가져오는 함수
    private getIceServers: () => Promise<RTCIceServerLike[]>,
    private resolvePeerKey: ResolvePeerKey,
    private onChange: (info: CallInfo) => void
  ) {
    this.unsub = this.signaling.on((msg) => this.handleSignal(msg));
  }

  private update(patch: Partial<CallInfo>) {
    this.info = { ...this.info, ...patch };
    this.onChange(this.info);
  }

  getRemoteStream() {
    return this.remoteStream;
  }

  /* --------------------------- 발신 --------------------------- */

  async startCall(peerId: string) {
    this.peerId = peerId;
    this.update({ peerId, state: 'outgoing', error: undefined });
    await this.setupPeerConnection();

    const offer = await this.pc!.createOffer({ offerToReceiveAudio: true });
    await this.pc!.setLocalDescription(offer);

    const sdp = this.pc!.localDescription!.sdp;
    this.signaling.signal({
      type: 'call-offer',
      to: peerId,
      sdp,
      sig: sign(sdp, this.identity.secretKey),
      from_pubkey: this.identity.publicKey,
    });
  }

  /* --------------------------- 수신 --------------------------- */

  private onIncomingOffer(msg: Extract<SignalMessage, { type: 'call-offer' }>) {
    // 이미 통화 중이면 자동 거절
    if (this.info.state !== 'idle' && this.info.state !== 'ended') {
      this.signaling.signal({ type: 'call-reject', to: msg.from, reason: 'busy' });
      return;
    }
    this.pendingOffer = msg;
    this.peerId = msg.from;
    this.update({ peerId: msg.from, state: 'incoming', error: undefined });
    // 사용자가 잠금화면/푸시 알림에서 이미 '받기'를 눌렀다면 자동 수락
    if (this.autoAcceptPeer && this.autoAcceptPeer === msg.from) {
      this.autoAcceptPeer = null;
      this.acceptCall();
    }
  }

  /**
   * 푸시/CallKit 에서 사용자가 '받기'를 누른 뒤, WebRTC offer 가 아직 도착 전일 때 무장.
   * offer 가 도착하면 자동으로 수락한다. 이미 도착해 있으면 즉시 수락.
   */
  armAutoAccept(peerId: string) {
    if (this.pendingOffer && this.pendingOffer.from === peerId && this.info.state === 'incoming') {
      this.acceptCall();
    } else {
      this.autoAcceptPeer = peerId;
    }
  }

  async acceptCall() {
    const msg = this.pendingOffer;
    if (!msg) return;
    this.update({ state: 'connecting' });

    // 발신자 공개키를 서버 기록과 대조(TOFU/피닝) 후 서명 검증
    const serverKey = await this.resolvePeerKey(msg.from);
    if (serverKey !== msg.from_pubkey || !verify(msg.sdp, msg.sig, msg.from_pubkey)) {
      this.fail('발신자 신원 검증 실패 — 통화를 차단했습니다.');
      this.signaling.signal({ type: 'call-reject', to: msg.from, reason: 'verify-failed' });
      return;
    }
    this.peerPublicKey = msg.from_pubkey;

    await this.setupPeerConnection();
    await this.pc!.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }));
    this.remoteDescSet = true;
    await this.drainCandidates();

    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);
    const sdp = this.pc!.localDescription!.sdp;
    this.signaling.signal({
      type: 'call-answer',
      to: msg.from,
      sdp,
      sig: sign(sdp, this.identity.secretKey),
    });

    this.computeSafetyNumber();
  }

  rejectCall() {
    if (this.peerId) this.signaling.signal({ type: 'call-reject', to: this.peerId, reason: 'declined' });
    this.cleanup('ended');
  }

  /* --------------------------- 공통 --------------------------- */

  private async setupPeerConnection() {
    if (!(await ensureMicPermission())) {
      throw new Error('마이크 권한이 필요합니다.');
    }
    const iceServers = await this.getIceServers().catch(() => []);
    this.pc = new RTCPeerConnection({ iceServers: iceServers as any });

    this.localStream = await mediaDevices.getUserMedia({ audio: true, video: false });
    this.localStream.getTracks().forEach((t) => this.pc!.addTrack(t, this.localStream!));

    // @ts-ignore RN-WebRTC 이벤트
    this.pc.ontrack = (e: any) => {
      this.remoteStream = e.streams[0];
    };
    // @ts-ignore
    this.pc.onicecandidate = (e: any) => {
      if (e.candidate && this.peerId) {
        this.signaling.signal({ type: 'ice-candidate', to: this.peerId, candidate: e.candidate });
      }
    };
    // @ts-ignore
    this.pc.onconnectionstatechange = () => {
      const st = this.pc?.connectionState;
      if (st === 'connected') this.update({ state: 'connected' });
      else if (st === 'failed') this.fail('연결 실패');
      else if (st === 'disconnected' || st === 'closed') {
        if (this.info.state === 'connected') this.cleanup('ended');
      }
    };
  }

  private async handleSignal(msg: SignalMessage) {
    switch (msg.type) {
      case 'call-offer':
        this.onIncomingOffer(msg);
        break;

      case 'call-answer': {
        if (!this.pc || msg.from !== this.peerId) return;
        // 응답자 공개키를 서버에서 받아 검증하고 안전번호 계산
        const key = await this.resolvePeerKey(msg.from);
        if (!verify(msg.sdp, msg.sig, key)) {
          this.fail('상대 신원 검증 실패 — 통화를 차단했습니다.');
          return;
        }
        this.peerPublicKey = key;
        this.update({ state: 'connecting' });
        await this.pc.setRemoteDescription(
          new RTCSessionDescription({ type: 'answer', sdp: msg.sdp })
        );
        this.remoteDescSet = true;
        await this.drainCandidates();
        this.computeSafetyNumber();
        break;
      }

      case 'ice-candidate':
        if (msg.from !== this.peerId) return;
        if (this.remoteDescSet && this.pc) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch {
            /* 무시 */
          }
        } else {
          this.pendingCandidates.push(msg.candidate);
        }
        break;

      case 'call-reject':
        if (msg.from === this.peerId) this.cleanup('ended', reasonText(msg.reason));
        break;
      case 'call-cancel':
      case 'call-hangup':
        if (msg.from === this.peerId) this.cleanup('ended');
        break;
      case 'peer-offline':
        if (msg.to === this.peerId) this.cleanup('ended', '상대가 오프라인입니다.');
        break;
    }
  }

  private async drainCandidates() {
    if (!this.pc) return;
    for (const c of this.pendingCandidates) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        /* 무시 */
      }
    }
    this.pendingCandidates = [];
  }

  private computeSafetyNumber() {
    if (this.peerPublicKey) {
      this.update({ safetyNumber: safetyNumber(this.identity.publicKey, this.peerPublicKey) });
    }
  }

  toggleMute(): boolean {
    const track = this.localStream?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      this.update({ isMuted: !track.enabled });
      return !track.enabled;
    }
    return this.info.isMuted;
  }

  hangup() {
    if (this.peerId) {
      const type = this.info.state === 'outgoing' ? 'call-cancel' : 'call-hangup';
      this.signaling.signal({ type, to: this.peerId });
    }
    this.cleanup('ended');
  }

  private fail(error: string) {
    this.update({ state: 'failed', error });
    this.teardownMedia();
  }

  private cleanup(state: CallState, error?: string) {
    this.teardownMedia();
    this.update({ state, error });
    this.peerId = null;
    this.peerPublicKey = null;
    this.pendingOffer = null;
  }

  private teardownMedia() {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.remoteStream = null;
    this.remoteDescSet = false;
    this.pendingCandidates = [];
    try {
      this.pc?.close();
    } catch {
      /* noop */
    }
    this.pc = null;
  }

  dispose() {
    this.teardownMedia();
    this.unsub?.();
  }
}

function reasonText(reason?: string): string | undefined {
  switch (reason) {
    case 'busy':
      return '상대가 통화 중입니다.';
    case 'declined':
      return '상대가 통화를 거절했습니다.';
    case 'verify-failed':
      return '신원 검증에 실패했습니다.';
    default:
      return undefined;
  }
}
