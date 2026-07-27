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
app.use(express.json({ limit: '64kb' }));

// 아주 단순한 접근 로그
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.use('/api', router);

app.get('/', (_req, res) => res.type('text').send('SecretCall signaling server\n'));

const server = http.createServer(app);
attachSignaling(server);

server.listen(config.port, () => {
  console.log(`SecretCall 서버 실행 중: http://localhost:${config.port}`);
  console.log(`  - REST API:   /api/*`);
  console.log(`  - WebSocket:  /ws`);
});
