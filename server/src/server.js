import http from 'node:http';
import express from 'express';
import { config } from './config.js';
import { router } from './routes.js';
import { attachSignaling } from './signaling.js';
import { q } from './db.js'; // 스키마 초기화 + 조회

// 테스트 계정 시딩: 없으면 'issued' 상태로 생성(이미 있으면 건드리지 않음)
for (const { user_id, registration_code } of config.seedUsers) {
  if (!q.getUser.get(user_id)) {
    q.insertIssued.run({ user_id, registration_code, created_at: Date.now() });
    console.log(`[seed] 테스트 계정 준비: ${user_id}`);
  }
}

const app = express();
app.disable('x-powered-by'); // 서버 소프트웨어 노출 최소화
app.use(express.json({ limit: '64kb' }));

// 접근 로그: 프라이버시를 위해 기본 '비활성화'.
//   → 사용자 아이디·IP·요청 경로(누가 누구 키를 조회했는지 등)를 서버가 기록하지 않는다.
//   디버깅이 꼭 필요할 때만 환경변수 ACCESS_LOG=1 로 최소 로그(메서드+경로)를 남긴다.
if (process.env.ACCESS_LOG === '1') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

app.use('/api', router);

app.get('/', (_req, res) => res.type('text').send('SecretCall signaling server\n'));

const server = http.createServer(app);
attachSignaling(server);

server.listen(config.port, () => {
  console.log(`SecretCall 서버 실행 중: http://localhost:${config.port}`);
  console.log(`  - REST API:   /api/*`);
  console.log(`  - WebSocket:  /ws`);
});
