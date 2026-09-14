#!/usr/bin/env bash
# ==============================================================================
# scripts/dev-stop.sh
# Safe, Targeted Process Termination for FINAURA Background Services
# ==============================================================================

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUN_DIR="${ROOT_DIR}/.run"

echo "======================================================================"
echo "  FINAURA DEMO & DEVELOPMENT STOPPER"
echo "======================================================================"

SERVICES=("web" "server" "ml-service")

stop_service() {
    local service=$1
    local pid_file="${RUN_DIR}/${service}.pid"
    local cmd_file="${RUN_DIR}/${service}.cmd"

    if [ ! -f "$pid_file" ]; then
        echo "  [INFO] ${service}: Not running (no PID file found)."
        return 0
    fi

    local pid=$(cat "$pid_file" 2>/dev/null | tr -d ' \n\r')
    if [ -z "$pid" ]; then
        rm -f "$pid_file" "$cmd_file"
        echo "  [CLEANUP] Removed empty PID file for ${service}."
        return 0
    fi

    # Check if PID is alive
    if ! kill -0 "$pid" 2>/dev/null; then
        rm -f "$pid_file" "$cmd_file"
        echo "  [CLEANUP] Stale PID file removed for ${service} (PID $pid already stopped)."
        return 0
    fi

    # Inspect the actual command line of the PID for safety verification
    local actual_cmd=$(ps -p "$pid" -o command= 2>/dev/null || true)
    local expected_keyword=""

    case "$service" in
        "server")
            expected_keyword="node"
            ;;
        "ml-service")
            expected_keyword="python"
            ;;
        "web")
            expected_keyword="vite"
            # Note: could also be npm or node
            if ! echo "$actual_cmd" | grep -q -E "vite|npm|node"; then
                expected_keyword="MATCH_FAILED"
            fi
            ;;
        *)
            expected_keyword=""
            ;;
    esac

    # Validate process identity before killing
    local cmd_match=false
    if [ "$service" = "web" ]; then
        if echo "$actual_cmd" | grep -q -E "vite|npm|node"; then
            cmd_match=true
        fi
    elif [ -n "$expected_keyword" ] && echo "$actual_cmd" | grep -i -q "$expected_keyword"; then
        cmd_match=true
    fi

    if [ "$cmd_match" = true ]; then
        echo "  [STOP] Terminating ${service} (PID: $pid, cmd: ${actual_cmd:0:60}...)"
        local child_pids=$(pgrep -P "$pid" 2>/dev/null || true)
        kill -15 "$pid" 2>/dev/null || true
        if [ -n "$child_pids" ]; then
            kill -15 $child_pids 2>/dev/null || true
        fi
        
        # Wait up to 5 seconds for graceful exit
        local wait_sec=5
        while kill -0 "$pid" 2>/dev/null && [ $wait_sec -gt 0 ]; do
            sleep 1
            wait_sec=$((wait_sec - 1))
        done

        # Escalate to SIGKILL if still running
        if kill -0 "$pid" 2>/dev/null; then
            echo "  [FORCE] ${service} did not exit gracefully, sending SIGKILL..."
            kill -9 "$pid" 2>/dev/null || true
            if [ -n "$child_pids" ]; then
                kill -9 $child_pids 2>/dev/null || true
            fi
        fi

        rm -f "$pid_file" "$cmd_file"
        echo "  ✅ ${service} stopped successfully."
    else
        echo "  ⚠️ [WARN] PID $pid for ${service} did not match expected process signature!"
        echo "     Expected keyword: '${expected_keyword}', Actual: '${actual_cmd}'"
        echo "     Skipping kill command to avoid terminating an unrelated process."
        rm -f "$pid_file" "$cmd_file"
    fi
}

for svc in "${SERVICES[@]}"; do
    stop_service "$svc"
done

echo ""
echo "======================================================================"
echo "  STOP COMPLETE"
echo "======================================================================"
