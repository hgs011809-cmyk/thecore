/**
 * 수신 알림(푸시) 발송 — 외부 SDK 없이 Node 내장 모듈만 사용.
 *
 * - Android: FCM HTTP v1 (RS256 JWT → OAuth2 access token → messages:send)
 * - iOS:     APNs VoIP 푸시 (ES256 JWT + HTTP/2)
 *
 * 미설정 시 조용히 no-op 하므로, 푸시 없이도 서버는 정상 동작한다.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import http2 from 'node:http2';
import { config, fcmEnabled, apnsEnabled } from './config.js';

/* ----------------------------- FCM ----------------------------- */

let fcmToken = { value: '', exp: 0 }; // access token 캐시
let serviceAccount = null;

function loadServiceAccount() {
  if (!serviceAccount) {
    serviceAccount = JSON.parse(fs.readFileSync(config.push.fcm.serviceAccountFile, 'utf8'));
  }
  return serviceAccount;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getFcmAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (fcmToken.value && fcmToken.exp - 60 > now) return fcmToken.value;

  const sa = loadServiceAccount();
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(sa.private_key, 'base64url');
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`FCM 토큰 발급 실패: ${JSON.stringify(data)}`);
  fcmToken = { value: data.access_token, exp: now + data.expires_in };
  return fcmToken.value;
}

async function sendFcm(deviceToken, callerId) {
  const accessToken = await getFcmAccessToken();
  const projectId = config.push.fcm.projectId;
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        android: { priority: 'high' },
        // data-only 메시지로 백그라운드/종료 상태에서도 앱을 깨운다
        data: { type: 'incoming_call', from: String(callerId), ts: String(Date.now()) },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FCM 전송 실패(${res.status}): ${body}`);
  }
}

/* ----------------------------- APNs ---------------------------- */

let apnsKey = null;
function loadApnsKey() {
  if (!apnsKey) apnsKey = fs.readFileSync(config.push.apns.keyFile, 'utf8');
  return apnsKey;
}

let apnsJwt = { value: '', iat: 0 };
function getApnsJwt() {
  const now = Math.floor(Date.now() / 1000);
  if (apnsJwt.value && now - apnsJwt.iat < 3000) return apnsJwt.value; // <1h 재사용
  const { keyId, teamId } = config.push.apns;
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const payload = base64url(JSON.stringify({ iss: teamId, iat: now }));
  const signature = crypto
    .createSign('SHA256')
    .update(`${header}.${payload}`)
    .sign({ key: loadApnsKey(), dsaEncoding: 'ieee-p1363' }, 'base64url');
  apnsJwt = { value: `${header}.${payload}.${signature}`, iat: now };
  return apnsJwt.value;
}

function sendApns(voipToken, callerId) {
  return new Promise((resolve, reject) => {
    const host = config.push.apns.production
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com';
    const client = http2.connect(host);
    client.on('error', reject);

    const payload = JSON.stringify({
      aps: {},
      type: 'incoming_call',
      from: String(callerId),
      ts: Date.now(),
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${voipToken}`,
      authorization: `bearer ${getApnsJwt()}`,
      'apns-topic': `${config.push.apns.bundleId}.voip`,
      'apns-push-type': 'voip',
      'apns-priority': '10',
      'content-type': 'application/json',
    });

    let status = 0;
    let body = '';
    req.on('response', (h) => (status = h[':status']));
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      client.close();
      if (status === 200) resolve();
      else reject(new Error(`APNs 전송 실패(${status}): ${body}`));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

/* --------------------------- 공개 API --------------------------- */

/**
 * 사용자에게 "전화 왔어요" 푸시를 보낸다. 실패해도 예외를 삼켜 통화 흐름을 막지 않는다.
 * @param {object} user  db 사용자 레코드(push 토큰 포함)
 * @param {string} callerId 발신자 아이디
 */
export async function sendIncomingCallPush(user, callerId) {
  const push = user?.push || {};
  const jobs = [];
  if (fcmEnabled() && push.fcm) {
    jobs.push(sendFcm(push.fcm, callerId).catch((e) => console.warn('[push:fcm]', e.message)));
  }
  if (apnsEnabled() && push.apnsVoip) {
    jobs.push(sendApns(push.apnsVoip, callerId).catch((e) => console.warn('[push:apns]', e.message)));
  }
  if (jobs.length === 0) return false;
  await Promise.all(jobs);
  return true;
}
