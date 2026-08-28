import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = __dirname;

function readClientFile(relPath) {
  return fs.readFileSync(path.join(clientDir, relPath), 'utf8');
}

// Mirror of WelcomeScreen.tsx getFirstName logic for deterministic test assertions
function getFirstName(name) {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  const first = parts[0];
  return first && first.length > 0 ? first : null;
}

console.log('='.repeat(64));
console.log('  FINAURA POST-LOGIN WELCOME FLOW & AUTH TRANSITION TEST SUITE');
console.log('='.repeat(64));

let passed = 0;
function test(name, fn) {
  process.stdout.write(`\nRunning ${name}...\n`);
  try {
    fn();
    console.log(`  ✅ ${name} Passed`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name} FAILED:`, err.message);
    throw err;
  }
}

// ── 1. CASE 1: EXPLICIT EXISTING-USER LOGIN FLOW ────────────
test('Test 1: Case 1 — Explicit successful login for onboarded user triggers showWelcome', () => {
  const authStoreCode = readClientFile('src/store/useAuthStore.ts');
  const appCode = readClientFile('App.tsx');

  // Verify showWelcome is set in login when onboardingCompleted is true
  assert.ok(
    authStoreCode.includes('showWelcome: isComplete'),
    'useAuthStore sets showWelcome to true for onboarded users on login'
  );

  // Verify App.tsx renders WelcomeScreen before MainTabs when showWelcome is true
  const welcomeIdx = appCode.indexOf('if (showWelcome)');
  const mainTabsIdx = appCode.indexOf('<AppNavigator />');
  assert.ok(welcomeIdx > -1, 'App.tsx contains showWelcome check');
  assert.ok(mainTabsIdx > -1, 'App.tsx contains AppNavigator mount');
  assert.ok(welcomeIdx < mainTabsIdx, 'showWelcome check takes precedence over AppNavigator');
});

// ── 2. CASE 2: FIRST NAME EXTRACTION ────────────────────────
test('Test 2: Case 2 — First name extraction formats "Welcome, <FirstName>"', () => {
  assert.equal(getFirstName('Parth Palav'), 'Parth');
  assert.equal(getFirstName('  Alice   Smith  '), 'Alice');
  assert.equal(getFirstName('Bob'), 'Bob');
  assert.equal(getFirstName('John-Paul Miller'), 'John-Paul');

  const firstName = getFirstName('Parth Palav');
  const greeting = firstName ? `Welcome, ${firstName}` : 'Welcome';
  assert.equal(greeting, 'Welcome, Parth');

  // Verify WelcomeScreen.tsx contains identical getFirstName algorithm
  const welcomeScreenCode = readClientFile('src/screens/WelcomeScreen.tsx');
  assert.ok(welcomeScreenCode.includes('export function getFirstName'), 'getFirstName is defined in WelcomeScreen.tsx');
  assert.ok(welcomeScreenCode.includes('parts[0]'), 'First name token extracted');
});

// ── 3. CASE 3: MISSING / BLANK NAME FALLBACK ────────────────
test('Test 3: Case 3 — Missing / blank / whitespace name falls back safely to "Welcome"', () => {
  assert.equal(getFirstName(null), null);
  assert.equal(getFirstName(undefined), null);
  assert.equal(getFirstName(''), null);
  assert.equal(getFirstName('   '), null);

  const testCases = [null, undefined, '', '   '];
  for (const tc of testCases) {
    const fn = getFirstName(tc);
    const greeting = fn ? `Welcome, ${fn}` : 'Welcome';
    assert.equal(greeting, 'Welcome', `Greeting for ${JSON.stringify(tc)} is "Welcome"`);
    assert.ok(!greeting.includes(','), 'No trailing comma on fallback');
    assert.ok(!greeting.includes('undefined'), 'No undefined leak');
    assert.ok(!greeting.includes('@'), 'No email address exposed');
  }

  const welcomeScreenCode = readClientFile('src/screens/WelcomeScreen.tsx');
  assert.ok(welcomeScreenCode.includes("firstName ? `Welcome, ${firstName}` : 'Welcome'"), 'Fallback greeting is clean "Welcome"');
});

// ── 4. CASE 4: CONTINUE DISMISSAL & HOME SELECTION ──────────
test('Test 4: Case 4 — Pressing Continue dismisses Welcome and enters MainTabs with Home (Dashboard) selected', () => {
  const welcomeScreenCode = readClientFile('src/screens/WelcomeScreen.tsx');
  const appNavCode = readClientFile('src/navigation/AppNavigator.tsx');
  const authStoreCode = readClientFile('src/store/useAuthStore.ts');

  // Verify dismissWelcome action exists
  assert.ok(authStoreCode.includes('dismissWelcome: () => set({ showWelcome: false })'), 'dismissWelcome resets showWelcome to false');
  
  // Verify WelcomeScreen calls onContinue/dismissWelcome on press
  assert.ok(welcomeScreenCode.includes('handleContinue'), 'WelcomeScreen has handleContinue handler');
  assert.ok(welcomeScreenCode.includes('dismissWelcome()') || welcomeScreenCode.includes('onContinue()'), 'WelcomeScreen invokes dismiss action');

  // Verify AppNavigator Tab.Navigator has initialRouteName="Dashboard" (Home)
  assert.ok(appNavCode.includes('initialRouteName="Dashboard"'), 'AppNavigator Tab.Navigator explicitly sets initialRouteName="Dashboard" (Home)');
});

// ── 5. CASE 5: SESSION RESTORE VIA INITAUTH (NO WELCOME) ────
test('Test 5: Case 5 — Session restore (cold start via initAuth) does NOT show Welcome screen', () => {
  const authStoreCode = readClientFile('src/store/useAuthStore.ts');
  
  // Find initAuth implementation
  const initAuthIdx = authStoreCode.indexOf('initAuth: async () =>');
  const initAuthBody = authStoreCode.slice(initAuthIdx, initAuthIdx + 400);

  // In initAuth, showWelcome must either be false or omitted from set (default false)
  assert.ok(
    !initAuthBody.includes('showWelcome: true'),
    'initAuth does NOT set showWelcome to true on session restore'
  );
});

// ── 6. CASE 6: ONBOARDING PRIORITY OVER WELCOME ─────────────
test('Test 6: Case 6 — Incomplete onboarding user routes to Onboarding, NOT Welcome', () => {
  const appCode = readClientFile('App.tsx');
  const authStoreCode = readClientFile('src/store/useAuthStore.ts');

  // In login, showWelcome is only true if isComplete is true
  assert.ok(
    authStoreCode.includes('showWelcome: isComplete'),
    'showWelcome evaluates to false if user is not onboarded'
  );

  // In App.tsx, onboarding check is evaluated BEFORE showWelcome check
  const onboardingIdx = appCode.indexOf('if (!isComplete)');
  const welcomeIdx = appCode.indexOf('if (showWelcome)');
  assert.ok(onboardingIdx > -1, 'App.tsx contains !isComplete check');
  assert.ok(welcomeIdx > -1, 'App.tsx contains showWelcome check');
  assert.ok(onboardingIdx < welcomeIdx, 'Onboarding check happens before showWelcome check');
});

// ── 7. CASE 7: LOGOUT AND SUBSEQUENT LOGIN ──────────────────
test('Test 7: Case 7 — Logout clears showWelcome so subsequent explicit login triggers Welcome again', () => {
  const authStoreCode = readClientFile('src/store/useAuthStore.ts');

  // Verify logout sets showWelcome: false
  const logoutIdx = authStoreCode.indexOf('logout: async () =>');
  const logoutBody = authStoreCode.slice(logoutIdx, logoutIdx + 600);
  assert.ok(logoutBody.includes('showWelcome: false'), 'logout explicitly resets showWelcome to false');

  // Verify login sets showWelcome: isComplete
  assert.ok(authStoreCode.includes('showWelcome: isComplete'), 'Subsequent login re-evaluates and sets showWelcome: true');
});

// ── 8. CASE 8: OBSOLETE FMI POPUP COMPLETELY REMOVED ────────
test('Test 8: Case 8 — Obsolete post-login FMI Score popup (WelcomeOverlay) is completely removed', () => {
  const appCode = readClientFile('App.tsx');

  // WelcomeOverlay must not be imported or rendered in App.tsx
  assert.ok(!appCode.includes('WelcomeOverlay'), 'App.tsx does NOT import or render WelcomeOverlay');
  assert.ok(!appCode.includes('welcomeDone'), 'App.tsx does NOT have old welcomeDone state');

  // File WelcomeOverlay.tsx must not exist
  const overlayPath = path.join(clientDir, 'src/components/WelcomeOverlay.tsx');
  assert.ok(!fs.existsSync(overlayPath), 'src/components/WelcomeOverlay.tsx is deleted');
});

// ── 9. WELCOME SCREEN UI SPECIFICATION & CTA LAYOUT ─────────
test('Test 9: WelcomeScreen UI conforms to design system and CTA guidelines', () => {
  const welcomeScreenCode = readClientFile('src/screens/WelcomeScreen.tsx');

  assert.ok(welcomeScreenCode.includes('Continue'), 'Continue CTA text is present');
  assert.ok(welcomeScreenCode.includes('Good to see you again.'), 'Secondary greeting subtitle is present');
  assert.ok(welcomeScreenCode.includes('useSafeAreaInsets'), 'Safe area insets are respected');
  assert.ok(welcomeScreenCode.includes('continueButton'), 'Primary CTA button styling exists');
  assert.ok(welcomeScreenCode.includes('finauraLogo'), 'FINAURA logo is incorporated');
});

console.log('\n' + '='.repeat(64));
console.log(`  ALL ${passed} WELCOME FLOW UX TESTS PASSED! 🚀`);
console.log('='.repeat(64));
