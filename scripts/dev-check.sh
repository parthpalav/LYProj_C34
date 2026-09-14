#!/usr/bin/env bash
# ==============================================================================
# scripts/dev-check.sh
# Comprehensive Pre-Flight Diagnostic for FINAURA Local Development
# ==============================================================================

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

log_pass() {
    echo "  [PASS] $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

log_warn() {
    echo "  [WARN] $1"
    WARN_COUNT=$((WARN_COUNT + 1))
}

log_fail() {
    echo "  [FAIL] $1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

echo "======================================================================"
echo "  FINAURA PRE-FLIGHT ENVIRONMENT & SYSTEM CHECK"
echo "======================================================================"

# ── 1. Core Tooling Runtime ───────────────────────────────────────────────────
echo ""
echo "1. Runtime Runtimes & CLIs:"

# Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v 2>/dev/null)
    NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        log_pass "Node.js runtime: ${NODE_VER} (meets >= v18 requirement)"
    else
        log_warn "Node.js runtime: ${NODE_VER} (recommend >= v18 for best compatibility)"
    fi
else
    log_fail "Node.js runtime: Not installed or not in PATH."
fi

# npm
if command -v npm >/dev/null 2>&1; then
    NPM_VER=$(npm -v 2>/dev/null)
    log_pass "npm package manager: v${NPM_VER}"
else
    log_fail "npm package manager: Not found."
fi

# Python 3
if command -v python3 >/dev/null 2>&1; then
    PY_VER=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:3])))' 2>/dev/null)
    PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
    PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
    if [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 9 ]; then
        log_pass "Python 3 runtime: v${PY_VER} (meets >= 3.9 requirement)"
    else
        log_warn "Python 3 runtime: v${PY_VER} (recommend >= 3.9 for sentence-transformers)"
    fi
else
    log_fail "Python 3 runtime: Not found in PATH."
fi

# ── 2. Python ML Dependencies ─────────────────────────────────────────────────
echo ""
echo "2. Python ML Libraries:"

python3 -c "import flask, flask_cors, numpy, pandas, sklearn, sentence_transformers, matplotlib" >/dev/null 2>&1
if [ $? -eq 0 ]; then
    log_pass "All required Python libraries available (Flask, NumPy, Pandas, Scikit-Learn, SentenceTransformers, Matplotlib)"
else
    log_fail "Missing required Python packages. Remedy: pip install -r ml-service/requirements.txt"
fi

# ── 3. Database Infrastructure (MongoDB) ──────────────────────────────────────
echo ""
echo "3. Database Infrastructure (Prerequisite):"

# Check port 27017
python3 -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(1.0)
res = s.connect_ex(('127.0.0.1', 27017))
s.close()
exit(0 if res == 0 else 1)
" >/dev/null 2>&1

if [ $? -eq 0 ]; then
    log_pass "MongoDB is reachable on 127.0.0.1:27017"
else
    log_fail "MongoDB is NOT reachable on 127.0.0.1:27017. Remedy: start with 'brew services start mongodb-community' or run 'mongod'."
fi

# ── 4. Target Service Port Availability ───────────────────────────────────────
echo ""
echo "4. Target Service Ports (4000, 5001, 5173):"

check_port() {
    local port=$1
    local name=$2
    python3 -c "
import socket
try:
    s = socket.create_connection(('localhost', $port), timeout=0.5)
    s.close()
    exit(0)
except Exception:
    exit(1)
" >/dev/null 2>&1
    local status=$?
    if [ $status -eq 0 ]; then
        # Port is bound
        if [ -f "${ROOT_DIR}/.run/${name}.pid" ]; then
            local pid=$(cat "${ROOT_DIR}/.run/${name}.pid" 2>/dev/null)
            log_warn "Port $port (${name}): Currently bound by active FINAURA background process (PID: $pid)"
        else
            log_warn "Port $port (${name}): Already in use by another process. Ensure port is free before starting."
        fi
    else
        log_pass "Port $port (${name}): Available"
    fi
}

check_port 4000 "server"
check_port 5001 "ml-service"
check_port 5173 "web"

# ── 5. Environment Secret & Config Safety Audit ──────────────────────────────
echo ""
echo "5. Environment Configuration Audit (No Secrets Logged):"

# Server .env
SERVER_ENV="${ROOT_DIR}/server/.env"
if [ -f "$SERVER_ENV" ]; then
    log_pass "server/.env file: Present"
    
    # Check MONGO_URI
    if grep -q "^MONGO_URI=" "$SERVER_ENV"; then
        log_pass "server/MONGO_URI: Configured (masked)"
    else
        log_warn "server/MONGO_URI: Missing from server/.env (will fallback to default)"
    fi

    # Check JWT_SECRET fallback (hash-based check to avoid literal secret in script)
    if grep -q "^JWT_SECRET=" "$SERVER_ENV"; then
        JWT_VAL=$(grep "^JWT_SECRET=" "$SERVER_ENV" | cut -d= -f2- | tr -d ' "')
        JWT_HASH=$(printf "%s" "$JWT_VAL" | shasum -a 256 2>/dev/null | awk '{print $1}')
        if [ "$JWT_HASH" = "892db4002114dfa64ff1072f1a551dd912d72462850338ee5407e38753fab735" ] || [ -z "$JWT_VAL" ] || [ "$JWT_VAL" = "your_jwt_access_secret_key_here" ]; then
            log_warn "server/JWT_SECRET: DEFAULT/FALLBACK DETECTED (Phase 9 security item; dev mode safe)"
        else
            log_pass "server/JWT_SECRET: Custom secret configured (masked)"
        fi
    else
        log_warn "server/JWT_SECRET: Unset; hardcoded development fallback will be used (Phase 9 security item)"
    fi

    # Check ML_SERVICE_URL
    if grep -q "^ML_SERVICE_URL=" "$SERVER_ENV"; then
        log_pass "server/ML_SERVICE_URL: Configured"
    else
        log_warn "server/ML_SERVICE_URL: Not found in server/.env (defaults to http://localhost:5001)"
    fi
else
    log_warn "server/.env file: Not found. Remedy: copy server/.env.example to server/.env"
fi

# ML Service .env
ML_ENV="${ROOT_DIR}/ml-service/.env"
if [ -f "$ML_ENV" ]; then
    log_pass "ml-service/.env file: Present"
else
    log_warn "ml-service/.env file: Not found (will use default settings)"
fi

# Web .env
WEB_ENV="${ROOT_DIR}/web/.env"
if [ -f "$WEB_ENV" ]; then
    log_pass "web/.env file: Present"
else
    log_warn "web/.env file: Not found. Defaulting to http://localhost:4000"
fi

# ── 6. ML Model Artifacts ─────────────────────────────────────────────────────
echo ""
echo "6. Machine Learning Artifacts:"

check_file() {
    local file_path=$1
    local desc=$2
    if [ -f "${ROOT_DIR}/${file_path}" ]; then
        local sz=$(ls -lh "${ROOT_DIR}/${file_path}" | awk '{print $5}')
        log_pass "${desc}: Present (${sz})"
    else
        log_fail "${desc}: Missing at ${file_path}!"
    fi
}

check_file "ml-service/dataset.csv" "Production V3 Dataset"
check_file "ml-service/tfidf_v2_category_model.pkl" "V3 Category TF-IDF Model"
check_file "ml-service/tfidf_v2_category_vectorizer.pkl" "V3 Category TF-IDF Vectorizer"
check_file "ml-service/minilm_v2_type_model.pkl" "V3 Type Classifier Head"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "======================================================================"
echo "  DIAGNOSTIC SUMMARY: ${PASS_COUNT} PASS | ${WARN_COUNT} WARN | ${FAIL_COUNT} FAIL"
echo "======================================================================"

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "  Status: READY for local development and demo launch."
    exit 0
else
    echo "  Status: BLOCKED. Please resolve the FAIL items above before starting."
    exit 1
fi
