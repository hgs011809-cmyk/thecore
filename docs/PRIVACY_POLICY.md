# 개인정보처리방침 (SecretCall)

> ⚠️ **이 문서는 템플릿입니다.** `[대괄호]` 부분을 실제 정보로 채우고, 배포 전
> 법률 검토를 받으세요. 본 문서는 법률 자문이 아닙니다. 아래 내용은 이 앱의 실제
> 동작(개인정보 미수집, 종단간 암호화)에 맞춰 작성되었습니다.

**서비스명:** SecretCall
**운영자:** [회사/운영자명]
**문의:** [연락처 이메일]
**시행일:** [YYYY-MM-DD]

---

## 1. 개요

SecretCall 은 개인정보를 최소한으로만 처리하는 **종단간 암호화(E2EE) 음성통화** 앱입니다.
가입 시 이름·전화번호·이메일 등 개인정보를 요구하지 않으며, 운영자가 발급한 **아이디**와
**1회용 등록코드**만으로 가입합니다.

## 2. 수집·처리하는 정보

| 항목 | 목적 | 보관 |
|------|------|------|
| 사용자 아이디(운영자 발급) | 계정 식별, 통화 상대 지정 | 계정 삭제 시까지 |
| 신원 공개키(기기에서 생성) | 통화 암호화·안전번호 검증 | 계정 삭제 시까지 |
| 접속 토큰의 해시값 | 접속 인증 | 계정 삭제 시까지 |
| 기기 푸시 토큰(FCM/APNs) | 수신 전화 알림 | 계정 삭제·토큰 갱신 시까지 |

- **개인키**는 사용자 **기기의 보안 저장소(Keychain/Keystore)에만** 저장되며 서버로
  전송되지 않습니다.
- 통화 연결 과정에서 기기의 네트워크 주소(IP)가 통화 상대 및 STUN/TURN 서버에 일시적으로
  노출됩니다(음성통화의 기술적 특성). 이 정보는 저장하지 않습니다.

## 3. 수집하지 않는 정보

- 이름, 전화번호, 이메일, 주소, 생년월일 등 **신원 정보**
- **연락처/주소록**, 위치정보, 사진, 기기 식별자(광고 ID 등)
- **통화 내용(음성)** — 종단간 암호화되어 두 기기 사이에서만 복호화되며, 운영자·서버는
  통화 내용을 열람할 수 없습니다.

## 4. 통화 내용의 종단간 암호화

음성은 WebRTC(DTLS-SRTP)로 **두 통화자의 기기 사이에서만** 암호화·복호화됩니다.
서버는 연결 신호를 중계할 뿐 음성 데이터나 암호 키를 갖지 않습니다. 방화벽 환경에서
중계(TURN)를 거치더라도 데이터는 암호화된 상태로 전달되어 내용이 노출되지 않습니다.

## 5. 제3자 제공 및 처리위탁

서비스 제공에 필요한 범위에서 아래를 이용합니다.

| 수탁자 | 제공 정보 | 목적 |
|--------|-----------|------|
| Google (Firebase Cloud Messaging) | 안드로이드 푸시 토큰, 알림 페이로드(수신 전화·발신자 아이디) | 안드로이드 수신 알림 |
| Apple (APNs/PushKit) | iOS VoIP 푸시 토큰, 알림 페이로드 | iOS 수신 알림 |
| STUN/TURN 서버 [(운영자 자체 또는 [제공자])] | 기기 IP(일시적), (TURN의 경우) 암호화된 미디어 중계 | 통화 연결 |

- 기본 설정은 공개 STUN 서버(`stun.l.google.com`)를 사용할 수 있습니다. 개인정보 보호를
  위해 운영자가 **자체 STUN/TURN 서버**를 운영하는 것을 권장합니다.
- 위 목적 외 판매·광고 목적의 제3자 제공은 하지 않습니다.

## 6. 보유 및 파기

- 위 정보는 계정이 유효한 동안 보관하며, 계정 삭제 시 지체 없이 파기합니다.
- 개인정보를 수집하지 않으므로 별도의 프로파일링·마케팅 활용은 없습니다.

## 7. 이용자의 권리

- 이용자는 운영자에게 계정 삭제(가입 정보 파기)를 요청할 수 있습니다.
- 문의: [연락처 이메일]

## 8. 아동의 개인정보

본 서비스는 [만 14세 / 만 13세] 미만 아동을 대상으로 하지 않습니다.

## 9. 보안 조치

- 통화 종단간 암호화, 접속 토큰 해시 저장(원문 미저장), 신원키 서명 기반 중간자 공격 방지,
  서버 전송 구간 TLS(HTTPS/WSS) 적용.

## 10. 변경 고지

본 방침이 변경되는 경우 앱 또는 [웹사이트]를 통해 공지합니다.

---

### English (summary)

SecretCall is an end-to-end encrypted (E2EE) voice-calling app. We do **not** collect
name, phone number, email, contacts, or location. Sign-up uses only an operator-issued
**ID** and one-time code. We process: the ID, a device-generated **public key**, a hashed
auth token, and a push token (FCM/APNs) for incoming-call notifications. The private key
never leaves the device. **Call audio is end-to-end encrypted** and cannot be accessed by
the operator or servers. Push tokens and notification payloads are processed by Google (FCM)
and Apple (APNs). Contact: [email].
