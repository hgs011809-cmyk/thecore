/**
 * 신원(Identity) 암호화 모듈 — Ed25519.
 *
 * - 각 사용자는 기기에서 신원 키쌍을 생성한다. 개인키는 절대 기기를 벗어나지 않는다.
 * - 통화 SDP(DTLS 지문 포함)에 개인키로 서명하여, 서버가 지문을 바꿔치기하는
 *   중간자(MITM) 공격을 차단한다.
 * - 두 사람의 공개키로 "안전번호"를 만들어 육안/구두로 확인한다(TOFU).
 */
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

export interface IdentityKeyPair {
  publicKey: string; // base64
  secretKey: string; // base64 (기기 보안저장소에만 보관)
}

/** 새 신원 키쌍 생성. */
export function generateIdentity(): IdentityKeyPair {
  const kp = nacl.sign.keyPair();
  return {
    publicKey: util.encodeBase64(kp.publicKey),
    secretKey: util.encodeBase64(kp.secretKey),
  };
}

/** 메시지(문자열)에 서명 → base64 서명. */
export function sign(message: string, secretKeyB64: string): string {
  const msg = util.decodeUTF8(message);
  const sk = util.decodeBase64(secretKeyB64);
  return util.encodeBase64(nacl.sign.detached(msg, sk));
}

/** 서명 검증. */
export function verify(message: string, signatureB64: string, publicKeyB64: string): boolean {
  try {
    const msg = util.decodeUTF8(message);
    const sig = util.decodeBase64(signatureB64);
    const pk = util.decodeBase64(publicKeyB64);
    return nacl.sign.detached.verify(msg, sig, pk);
  } catch {
    return false;
  }
}

/**
 * 안전번호(Safety Number): 두 사람의 공개키로부터 결정적으로 만들어지는 숫자열.
 * 양쪽 화면에 같은 번호가 뜨면 도청/중간자 없음이 확인된다.
 * (공개키를 정렬해 합쳐서 순서와 무관하게 동일한 값이 나오도록 함)
 */
export function safetyNumber(pubKeyA_b64: string, pubKeyB_b64: string): string {
  const [a, b] = [pubKeyA_b64, pubKeyB_b64].sort();
  const combined = util.decodeBase64(a).length
    ? new Uint8Array([...util.decodeBase64(a), ...util.decodeBase64(b)])
    : new Uint8Array();
  const digest = nacl.hash(combined); // SHA-512, 64 bytes
  // 앞 30바이트를 5자리 숫자 12묶음으로 변환 → 60자리
  let out = '';
  for (let i = 0; i < 30; i += 5) {
    const chunk = digest.slice(i, i + 5);
    let n = 0;
    for (const byte of chunk) n = (n * 256 + byte) % 100000;
    out += String(n).padStart(5, '0');
    if (out.length % 20 === 15) out += '\n';
    else out += ' ';
  }
  return out.trim();
}
