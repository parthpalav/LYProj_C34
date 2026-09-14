#!/usr/bin/env bash
# ==============================================================================
# scripts/test_phase8_orchestration.sh
# Automated Test Suite for Phase 8 Research & Orchestration Tools
# ==============================================================================

set -e
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "======================================================================"
echo "  FINAURA PHASE 8 AUTOMATED VERIFICATION SUITE"
echo "======================================================================"

TEST_PASSED=0
TEST_FAILED=0

assert_test() {
    local desc=$1
    local cmd=$2
    echo -n "  Testing: ${desc}... "
    if eval "$cmd" >/dev/null 2>&1; then
        echo "✅ PASS"
        TEST_PASSED=$((TEST_PASSED + 1))
    else
        echo "❌ FAIL"
        TEST_FAILED=$((TEST_FAILED + 1))
    fi
}

# 1. Dev-Check Verification
echo ""
echo "1. Dev-Check Safety & Execution:"
assert_test "dev-check runs successfully (exit code 0)" "\"${SCRIPT_DIR}/dev-check.sh\""

DEV_CHECK_OUT=$("${SCRIPT_DIR}/dev-check.sh")
assert_test "dev-check masks JWT secrets" "! echo \"$DEV_CHECK_OUT\" | grep -qi -E 'jwt.*s[0-9]cr[0-9]t' && echo \"$DEV_CHECK_OUT\" | grep -q 'DEFAULT/FALLBACK DETECTED'"
assert_test "dev-check masks database passwords" "! echo \"$DEV_CHECK_OUT\" | grep -q -E 'mongodb://.*:.*@'"
assert_test "dev-check reports 15 PASS items" "echo \"$DEV_CHECK_OUT\" | grep -q '15 PASS'"

# 2. Process Stopper Idempotency
echo ""
echo "2. Process Stopper Idempotency:"
assert_test "dev-stop handles idle state cleanly without errors" "\"${SCRIPT_DIR}/dev-stop.sh\""

# 3. Benchmark Runner Execution
echo ""
echo "3. Authoritative Benchmark Runner:"
assert_test "generate_benchmarks.py runs and exits 0" "python3 \"${ROOT_DIR}/research/scripts/generate_benchmarks.py\""

# 4. Artifact File Existence
echo ""
echo "4. Generated Artifact File Presence:"
RESULTS_DIR="${ROOT_DIR}/research/results"
assert_test "benchmark_metrics.json exists" "[ -f '${RESULTS_DIR}/benchmark_metrics.json' ]"
assert_test "production_v3_category_metrics.csv exists" "[ -f '${RESULTS_DIR}/production_v3_category_metrics.csv' ]"
assert_test "production_v3_per_class_metrics.csv exists" "[ -f '${RESULTS_DIR}/production_v3_per_class_metrics.csv' ]"
assert_test "hybrid_blind_metrics.csv exists" "[ -f '${RESULTS_DIR}/hybrid_blind_metrics.csv' ]"
assert_test "monte_carlo_benchmarks.csv exists" "[ -f '${RESULTS_DIR}/monte_carlo_benchmarks.csv' ]"
assert_test "fmi_characterisation.csv exists" "[ -f '${RESULTS_DIR}/fmi_characterisation.csv' ]"
assert_test "family_fmi_characterisation.csv exists" "[ -f '${RESULTS_DIR}/family_fmi_characterisation.csv' ]"
assert_test "research_tables.tex exists" "[ -f '${RESULTS_DIR}/research_tables.tex' ]"
assert_test "benchmark_summary.md exists" "[ -f '${RESULTS_DIR}/benchmark_summary.md' ]"
assert_test "figures/per_class_f1.png exists" "[ -f '${RESULTS_DIR}/figures/per_class_f1.png' ]"
assert_test "figures/monte_carlo_percentiles.png exists" "[ -f '${RESULTS_DIR}/figures/monte_carlo_percentiles.png' ]"
assert_test "figures/crn_variance_reduction.png exists" "[ -f '${RESULTS_DIR}/figures/crn_variance_reduction.png' ]"
assert_test "figures/family_vs_indiv_fmi.png exists" "[ -f '${RESULTS_DIR}/figures/family_vs_indiv_fmi.png' ]"

# 5. Numerical & Scientific Invariant Validation (Python)
echo ""
echo "5. Scientific Invariant Validation:"
python3 - <<'EOF'
import json, sys, os
import pandas as pd

results_dir = os.path.abspath("research/results")

# 1. JSON Metrics
with open(os.path.join(results_dir, "benchmark_metrics.json")) as f:
    data = json.load(f)

# Dataset invariants
assert data["production_v3"]["dataset"]["samples"] == 697, "Dataset row count must be 697"
assert data["production_v3"]["dataset"]["categories_count"] == 14, "Must have 14 canonical categories"

# Model architecture invariants
assert "TF-IDF" in data["model_architecture"]["category_classifier"]["architecture"]
assert "MiniLM" in data["model_architecture"]["type_classifier"]["architecture"]

# Metric invariants
ho = data["production_v3"]["category_model"]["held_out"]
assert 0.78 <= ho["macro_f1"] <= 0.79, f"Expected Macro F1 ~78.54%, got {ho['macro_f1']}"
assert 0.79 <= ho["accuracy"] <= 0.80, f"Expected Accuracy ~79.29%, got {ho['accuracy']}"

hb = data["production_v3"]["hybrid_blind_challenge"]
assert hb["category_accuracy"] >= 0.98, f"Expected Hybrid Category >=98%, got {hb['category_accuracy']}"
assert hb["type_accuracy"] >= 0.90, f"Expected Hybrid Type >=90%, got {hb['type_accuracy']}"

# FMI invariants
fmi = data["fmi_characterisation"]
assert fmi["fmi_formula"] == "0.40*D1 + 0.30*D2 + 0.30*D3"
assert fmi["family_proof"]["proof_inequality"] is True

# CRN verification
crn = data["monte_carlo"]["crn_verification"]
assert crn["variance_reduction_pct"] > 0, "CRN must demonstrate positive variance reduction"

# 2. CSV Validation
df_per_class = pd.read_csv(os.path.join(results_dir, "production_v3_per_class_metrics.csv"))
assert len(df_per_class) == 14, "Per-class CSV must contain all 14 categories"
assert list(df_per_class.columns) == ["category", "precision", "recall", "f1_score", "support"]

df_mc = pd.read_csv(os.path.join(results_dir, "monte_carlo_benchmarks.csv"))
assert len(df_mc) == 3, "Monte Carlo CSV must evaluate 3 representative scenarios"

print("  All scientific invariants verified successfully!")
EOF
assert_test "python invariant verification script" "true"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "======================================================================"
echo "  TEST RESULTS: ${TEST_PASSED} PASSED | ${TEST_FAILED} FAILED"
echo "======================================================================"

if [ "$TEST_FAILED" -eq 0 ]; then
    echo "  Status: ALL PHASE 8 ORCHESTRATION TESTS PASSED 🚀"
    exit 0
else
    echo "  Status: TEST FAILURES DETECTED."
    exit 1
fi
