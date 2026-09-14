#!/usr/bin/env bash
# ==============================================================================
# scripts/dev-start.sh
# Safe Background Launcher for FINAURA Core Services
# ==============================================================================

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

LOGS_DIR="${ROOT_DIR}/.logs"
RUN_DIR="${ROOT_DIR}/.run"

mkdir -p "$LOGS_DIR" "$RUN_DIR"

echo "======================================================================"
echo "  FINAURA DEMO & DEVELOPMENT LAUNCHER"
echo "======================================================================"

# ── 1. Pre-flight Environment Check ───────────────────────────────────────────
echo ""
echo "Running pre-flight checks..."
"${SCRIPT_DIR}/dev-check.sh"
CHECK_STATUS=$?

if [ $CHECK_STATUS -ne 0 ]; then
    echo ""
    echo "❌ Pre-flight checks failed. Please address the errors above before launching."
    exit 1
fi

echo ""
echo "Starting services in background..."

# Helper to check if a process is already running via PID file
is_running() {
    local service=$1
    local pid_file="${RUN_DIR}/${service}.pid"
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file" 2>/dev/null)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# ── 2. Start Flask ML Microservice (Port 5001) ─────────────────────────────────
if is_running "ml-service"; then
    echo "  [SKIP] ML Service is already running (PID: $(cat "${RUN_DIR}/ml-service.pid"))"
else
    echo "  [START] Launching Flask ML Service (port 5001)..."
    (
        cd "${ROOT_DIR}/ml-service" || exit 1
        exec python3 api.py > "${LOGS_DIR}/ml-service.log" 2>&1
    ) &
    ML_PID=$!
    echo "$ML_PID" > "${RUN_DIR}/ml-service.pid"
    echo "python3 api.py" > "${RUN_DIR}/ml-service.cmd"
fi

# ── 3. Start Express Backend API (Port 4000) ──────────────────────────────────
if is_running "server"; then
    echo "  [SKIP] Express Backend is already running (PID: $(cat "${RUN_DIR}/server.pid"))"
else
    echo "  [START] Launching Express Backend Server (port 4000)..."
    (
        cd "${ROOT_DIR}/server" || exit 1
        exec node index.js > "${LOGS_DIR}/server.log" 2>&1
    ) &
    SERVER_PID=$!
    echo "$SERVER_PID" > "${RUN_DIR}/server.pid"
    echo "node index.js" > "${RUN_DIR}/server.cmd"
fi

# ── 4. Start Web Application (Port 5173) ──────────────────────────────────────
if is_running "web"; then
    echo "  [SKIP] Web Frontend is already running (PID: $(cat "${RUN_DIR}/web.pid"))"
else
    echo "  [START] Launching Web Application (port 5173)..."
    (
        cd "${ROOT_DIR}/web" || exit 1
        exec npm run dev > "${LOGS_DIR}/web.log" 2>&1
    ) &
    WEB_PID=$!
    echo "$WEB_PID" > "${RUN_DIR}/web.pid"
    echo "npm run dev" > "${RUN_DIR}/web.cmd"
fi

# ── 5. Poll for HTTP Readiness (Up to 15 seconds) ─────────────────────────────
echo ""
echo "Waiting for services to become responsive..."

wait_for_port() {
    local port=$1
    local name=$2
    local attempts=15
    while [ $attempts -gt 0 ]; do
        python3 -c "
import socket
try:
    s = socket.create_connection(('localhost', $port), timeout=0.5)
    s.close()
    exit(0)
except Exception:
    exit(1)
" >/dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo "  ✅ ${name} is UP on http://localhost:${port}"
            return 0
        fi
        sleep 1
        attempts=$((attempts - 1))
    done
    echo "  ⚠️ ${name} on port ${port} did not respond within 15 seconds. Check logs in .logs/${name}.log"
    return 1
}

wait_for_port 5001 "ml-service"
wait_for_port 4000 "server"
wait_for_port 5173 "web"

# ── 6. Summary and Access Information ─────────────────────────────────────────
echo ""
echo "======================================================================"
echo "  FINAURA STACK READY"
echo "======================================================================"
echo ""
echo "  Active Endpoints:"
echo "    • Express Backend API: http://localhost:4000"
echo "    • Flask ML Microservice: http://localhost:5001"
echo "    • Web Planning & Reports: http://localhost:5173"
echo ""
echo "  Logs:"
echo "    • Backend:     tail -f .logs/server.log"
echo "    • ML Service:  tail -f .logs/ml-service.log"
echo "    • Web Frontend: tail -f .logs/web.log"
echo ""
echo "  Mobile Development (Optional):"
echo "    To launch the mobile Expo client, run:"
echo "      cd client && npm start"
echo ""
echo "  To stop the running stack:"
echo "    ./scripts/dev-stop.sh"
echo "======================================================================"
