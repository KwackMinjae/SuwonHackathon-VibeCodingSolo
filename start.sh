#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 수원시그널 시작 중..."

# 기존 프로세스 정리
fuser -k 3001/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true
sleep 1

# 백엔드 빌드 & 실행
echo "📦 백엔드 빌드 중..."
cd "$PROJECT_DIR/backend"
npm install --cache /tmp/npm-cache 2>/dev/null || true
PYTHON=/usr/bin/python3 npm rebuild better-sqlite3 --cache /tmp/npm-cache 2>/dev/null || true
npx tsc

echo "🖥️  백엔드 서버 시작 (포트 3001)..."
node dist/server.js &
BACKEND_PID=$!
sleep 3

# 헬스체크
if curl -sf http://localhost:3001/api/health > /dev/null; then
  echo "✅ 백엔드 실행 중 (PID: $BACKEND_PID)"
else
  echo "❌ 백엔드 시작 실패"
  exit 1
fi

# 프론트엔드 빌드 & 실행
echo "🎨 프론트엔드 빌드 중..."
cd "$PROJECT_DIR"
npm run build

echo "🌐 프론트엔드 서버 시작 (포트 5173)..."
npx vite preview --port 5173 &
FRONTEND_PID=$!
sleep 3

echo ""
echo "════════════════════════════════════"
echo "✅ 수원시그널 실행 완료!"
echo "   프론트엔드: http://localhost:5173/mkdatingapp/"
echo "   백엔드 API:  http://localhost:3001/api/health"
echo "════════════════════════════════════"
echo ""
echo "종료하려면 Ctrl+C를 누르세요."

# 시그널 처리
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '서버 종료됨'; exit 0" INT TERM

wait
