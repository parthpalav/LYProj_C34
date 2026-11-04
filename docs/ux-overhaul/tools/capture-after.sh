#!/bin/zsh
# Re-captures every "after" screenshot into ../after and rebuilds the before/after docx.
# Needs: server (4000), ML service (5001), Metro (npx expo start --dev-client) and the app open
# on the booted simulator, signed in as the test account. Takes about four minutes.
#
#   ./capture-after.sh [email] [password]
D=${0:A:h}
S=$D/sim.sh
EMAIL=${1:-claude.uitest@example.com}
PASS=${2:-'Uitest#2026'}

shot() { sleep ${2:-2}; $S shot $1 >/dev/null && echo "  $1"; }
store() { # store <file regex> <js using s>
  node $D/cdp.mjs "(() => { const m = __r.getModules(); for (const [k, v] of (m instanceof Map ? m : Object.entries(m))) if (v && new RegExp('$1').test(v.verboseName || '')) { const s = __r(k); $2; return 'ok'; } return 'module not found'; })()" >/dev/null
}

# The dev "Open debugger to view warnings" bar would sit in every shot.
store 'Libraries/LogBox/LogBox\\.js$' '(s.default || s).ignoreAllLogs(true)'
$S theme light >/dev/null

echo "Home and tabs"
$S nav Dashboard >/dev/null; $S scroll 0 >/dev/null; shot 10-dash 4
$S scroll 700 >/dev/null; shot 11-dash; $S scroll 1400 >/dev/null; shot 12-dash; $S scroll 0 >/dev/null
$S press 'Update Current Balance' >/dev/null; shot 43-update-balance; $S press '^\s*\|\s*Cancel' >/dev/null; sleep 1
$S nav Transactions >/dev/null; shot 20-Transactions 3
$S press 'Transaction options' >/dev/null; shot 41-txn-options; $S press '^Close' >/dev/null; sleep 1
$S press 'Open advanced filters' >/dev/null; shot 42-filters; $S press '^Done' >/dev/null; sleep 1
$S nav QuickAdd >/dev/null; shot 40-entry 3; $S back >/dev/null; sleep 1
$S nav Chat >/dev/null; shot 20-Chat 3
$S nav Plan >/dev/null; shot 70-plan 3

echo "Stack screens"
for route file extra in Liabilities 20-Liabilities 0 Goals 30-Goals 0 Assets 30-Assets 0 Family 30-Family 0 \
  Alerts 71-notifications 0 Review 72-review 0 Envelopes 73-roundups 0 Insights 75-insights 0; do
  $S nav $route >/dev/null; shot $file 3; $S back >/dev/null; sleep 1
done
$S nav Profile >/dev/null; shot 20-Profile 3
$S press 'Planning assumptions' >/dev/null; shot 44-edit-assumptions; $S press '^\s*\|\s*Cancel' >/dev/null; sleep 1; $S back >/dev/null; sleep 1
$S nav FMI >/dev/null; shot 30-FMI 3; $S scroll 900 >/dev/null; shot 31-FMI; $S back >/dev/null; sleep 1
$S nav IncomeFlow >/dev/null; shot 30-IncomeFlow 3; $S scroll 600 >/dev/null; shot 31-IncomeFlow; $S back >/dev/null; sleep 1
$S nav FinancialOutlook >/dev/null; shot 30-FinancialOutlook 9
$S press 'Increase Invest each month' >/dev/null; $S press 'Increase Invest each month' >/dev/null; $S scroll 330 >/dev/null; shot 77-whatif 7
$S scroll 1500 >/dev/null; shot 31-FinancialOutlook; $S back >/dev/null; sleep 1
$S nav Recap >/dev/null; shot 74-recap 3; $S press 'Close recap' >/dev/null; sleep 1

echo "Dark mode"
$S theme dark >/dev/null
$S nav Dashboard >/dev/null; $S scroll 0 >/dev/null; shot 50-dark-dash 3; $S scroll 1300 >/dev/null; shot 53-dark-dash2; $S scroll 0 >/dev/null
$S nav Transactions >/dev/null; shot 51-dark-Transactions 3
$S nav Chat >/dev/null; shot 51-dark-Chat 3
for route file in FMI 52-dark-FMI Goals 52-dark-Goals IncomeFlow 52-dark-IncomeFlow; do
  $S nav $route >/dev/null; shot $file 3; $S back >/dev/null; sleep 1
done
$S theme light >/dev/null

echo "Onboarding preview (local state only, nothing is saved)"
store 'src/store/useAuthStore\\.ts$' "const a = s.useAuthStore; globalThis.__saved = { user: a.getState().user, onboardingCompleted: a.getState().onboardingCompleted }; a.setState({ onboardingCompleted: false, user: { ...a.getState().user, onboardingComplete: false, onboardingCompleted: false } })"
shot 76-onboarding 3
store 'src/store/useAuthStore\\.ts$' 's.useAuthStore.setState(globalThis.__saved)'
sleep 2

echo "Sign-in flow"
store 'src/store/useAuthStore\\.ts$' 's.useAuthStore.getState().logout()'
shot 01 4
$S press 'Create account' >/dev/null; shot 60-register
$S press '^\s*\|\s*Sign in\s+Sign in\s*$' >/dev/null; sleep 1
$S press 'Forgot' >/dev/null; shot 61-forgot
$S press 'Back to sign in' >/dev/null; sleep 1
store 'src/store/useAuthStore\\.ts$' "s.useAuthStore.getState().login({ email: '$EMAIL', password: '$PASS' })"
shot 03 5
$S press 'Continue to Home' >/dev/null

echo "Building docx"
cd $D && node build.js
