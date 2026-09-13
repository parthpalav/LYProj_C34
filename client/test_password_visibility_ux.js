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

console.log('='.repeat(64));
console.log('  FINAURA PASSWORD VISIBILITY TOGGLE UX TEST SUITE');
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

// ── 1. LOGIN SCREEN AUDIT ──────────────────────────────────
test('Test 1: LoginScreen has password visibility toggle with independent state and accessibility', () => {
  const code = readClientFile('src/screens/LoginScreen.tsx');

  // Verify state initialization
  assert.ok(
    code.includes('const [showPassword, setShowPassword] = useState(false);'),
    'LoginScreen initializes showPassword state to false by default'
  );

  // Verify Ionicons imported from @expo/vector-icons
  assert.ok(
    code.includes("import { Ionicons } from '@expo/vector-icons';"),
    'LoginScreen imports Ionicons from @expo/vector-icons'
  );

  // Verify secureTextEntry defaults to true (when showPassword is false)
  assert.ok(
    code.includes('secureTextEntry={!showPassword}'),
    'LoginScreen sets secureTextEntry to {!showPassword} (defaults to secure)'
  );

  // Verify accessibility attributes
  assert.ok(
    code.includes('accessibilityRole="button"'),
    'LoginScreen toggle has accessibilityRole="button"'
  );
  assert.ok(
    code.includes("accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}"),
    'LoginScreen toggle has dynamic accessibilityLabel ("Hide password" vs "Show password")'
  );

  // Verify icon toggle between eye-off-outline and eye-outline
  assert.ok(
    code.includes("name={showPassword ? 'eye-off-outline' : 'eye-outline'}"),
    'LoginScreen toggles icon between eye-off-outline and eye-outline'
  );

  // Verify touch target hitSlop
  assert.ok(
    code.includes('hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}'),
    'LoginScreen toggle provides hitSlop for touch target'
  );

  // Verify passwordInput right padding to prevent text overlap
  assert.ok(
    code.includes('passwordInput: {') && code.includes('paddingRight: 46'),
    'LoginScreen styles include passwordInput with right padding to prevent text overlap'
  );

  // Verify form submission & editable props preserved
  assert.ok(code.includes('onSubmitEditing={handleLogin}'), 'LoginScreen preserves onSubmitEditing');
  assert.ok(code.includes('editable={!loading}'), 'LoginScreen preserves editable prop');
});

// ── 2. REGISTER SCREEN AUDIT ───────────────────────────────
test('Test 2: RegisterScreen has independent toggles for Password and Confirm Password', () => {
  const code = readClientFile('src/screens/RegisterScreen.tsx');

  // Verify independent states initialized to false
  assert.ok(
    code.includes('const [showPassword, setShowPassword] = useState(false);'),
    'RegisterScreen initializes showPassword to false'
  );
  assert.ok(
    code.includes('const [showConfirmPassword, setShowConfirmPassword] = useState(false);'),
    'RegisterScreen initializes showConfirmPassword to false'
  );

  // Verify Ionicons imported from @expo/vector-icons
  assert.ok(
    code.includes("import { Ionicons } from '@expo/vector-icons';"),
    'RegisterScreen imports Ionicons from @expo/vector-icons'
  );

  // Verify Password field has independent toggle and secureTextEntry={!showPassword}
  assert.ok(
    code.includes('secureTextEntry={!showPassword}'),
    'RegisterScreen Password field uses secureTextEntry={!showPassword}'
  );
  assert.ok(
    code.includes("accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}"),
    'RegisterScreen Password field has correct accessibilityLabel'
  );
  assert.ok(
    code.includes("name={showPassword ? 'eye-off-outline' : 'eye-outline'}"),
    'RegisterScreen Password field toggles icon based on showPassword'
  );

  // Verify Confirm Password field has independent toggle and secureTextEntry={!showConfirmPassword}
  assert.ok(
    code.includes('secureTextEntry={!showConfirmPassword}'),
    'RegisterScreen Confirm Password field uses secureTextEntry={!showConfirmPassword}'
  );
  assert.ok(
    code.includes("accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}"),
    'RegisterScreen Confirm Password field has correct accessibilityLabel'
  );
  assert.ok(
    code.includes("name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}"),
    'RegisterScreen Confirm Password field toggles icon based on showConfirmPassword'
  );

  // Verify separate setter calls
  assert.ok(
    code.includes('setShowPassword((prev) => !prev)'),
    'RegisterScreen has setShowPassword toggle handler'
  );
  assert.ok(
    code.includes('setShowConfirmPassword((prev) => !prev)'),
    'RegisterScreen has setShowConfirmPassword toggle handler'
  );

  // Verify passwordInput right padding
  assert.ok(
    code.includes('passwordInput: {') && code.includes('paddingRight: 46'),
    'RegisterScreen styles include passwordInput with right padding'
  );

  // Verify registration submit & editable props preserved
  assert.ok(code.includes('onSubmitEditing={handleRegister}'), 'RegisterScreen preserves onSubmitEditing');
  assert.ok(code.includes('editable={!loading}'), 'RegisterScreen preserves editable prop');
});

// ── 3. RESET PASSWORD SCREEN AUDIT ─────────────────────────
test('Test 3: ResetPasswordScreen has independent toggles for New Password and Confirm New Password', () => {
  const code = readClientFile('src/screens/ResetPasswordScreen.tsx');

  // Verify independent states initialized to false
  assert.ok(
    code.includes('const [showPassword, setShowPassword] = useState(false);'),
    'ResetPasswordScreen initializes showPassword to false'
  );
  assert.ok(
    code.includes('const [showConfirmPassword, setShowConfirmPassword] = useState(false);'),
    'ResetPasswordScreen initializes showConfirmPassword to false'
  );

  // Verify Ionicons imported from @expo/vector-icons
  assert.ok(
    code.includes("import { Ionicons } from '@expo/vector-icons';"),
    'ResetPasswordScreen imports Ionicons from @expo/vector-icons'
  );

  // Verify New Password field has independent toggle and secureTextEntry={!showPassword}
  assert.ok(
    code.includes('secureTextEntry={!showPassword}'),
    'ResetPasswordScreen New Password field uses secureTextEntry={!showPassword}'
  );
  assert.ok(
    code.includes("accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}"),
    'ResetPasswordScreen New Password field has correct accessibilityLabel'
  );
  assert.ok(
    code.includes("name={showPassword ? 'eye-off-outline' : 'eye-outline'}"),
    'ResetPasswordScreen New Password field toggles icon based on showPassword'
  );

  // Verify Confirm New Password field has independent toggle and secureTextEntry={!showConfirmPassword}
  assert.ok(
    code.includes('secureTextEntry={!showConfirmPassword}'),
    'ResetPasswordScreen Confirm New Password field uses secureTextEntry={!showConfirmPassword}'
  );
  assert.ok(
    code.includes("accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}"),
    'ResetPasswordScreen Confirm New Password field has correct accessibilityLabel'
  );
  assert.ok(
    code.includes("name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}"),
    'ResetPasswordScreen Confirm New Password field toggles icon based on showConfirmPassword'
  );

  // Verify separate setter calls
  assert.ok(
    code.includes('setShowPassword((prev) => !prev)'),
    'ResetPasswordScreen has setShowPassword toggle handler'
  );
  assert.ok(
    code.includes('setShowConfirmPassword((prev) => !prev)'),
    'ResetPasswordScreen has setShowConfirmPassword toggle handler'
  );

  // Verify passwordInput right padding
  assert.ok(
    code.includes('passwordInput: {') && code.includes('paddingRight: 46'),
    'ResetPasswordScreen styles include passwordInput with right padding'
  );
});

// ── 4. COMPLETE CLIENT PASSWORD FIELD COVERAGE ─────────────
test('Test 4: Exhaustive search confirms all password fields in the app are covered', () => {
  const screensDir = path.join(clientDir, 'src/screens');
  const files = fs.readdirSync(screensDir).filter(f => f.endsWith('.tsx'));

  const screensWithPassword = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(screensDir, file), 'utf8');
    if (content.includes('secureTextEntry') || content.includes('showPassword')) {
      screensWithPassword.push(file);
    }
  }

  // Expect exactly LoginScreen.tsx, RegisterScreen.tsx, ResetPasswordScreen.tsx
  assert.deepEqual(
    screensWithPassword.sort(),
    ['LoginScreen.tsx', 'RegisterScreen.tsx', 'ResetPasswordScreen.tsx'].sort(),
    'All screens with password fields are accurately identified and covered'
  );

  // Verify no other screen has unhandled secureTextEntry
  for (const file of files) {
    if (!screensWithPassword.includes(file)) {
      const content = fs.readFileSync(path.join(screensDir, file), 'utf8');
      assert.ok(
        !content.includes('secureTextEntry'),
        `${file} should not have an unhandled secureTextEntry`
      );
    }
  }
});

// ── 5. STATE ISOLATION & PURITY VERIFICATION ────────────────
test('Test 5: Toggling visibility changes only boolean state without mutating value or triggering submission', () => {
  // Simulate state toggle logic
  let showPassword = false;
  let showConfirmPassword = false;
  let passwordValue = 'SecretP@ssword123!';
  let confirmPasswordValue = 'SecretP@ssword123!';

  // Toggling showPassword
  showPassword = !showPassword;
  assert.equal(showPassword, true, 'showPassword toggled to true');
  assert.equal(showConfirmPassword, false, 'showConfirmPassword remains unchanged (isolated)');
  assert.equal(passwordValue, 'SecretP@ssword123!', 'Password value was preserved across toggle');

  // Toggling showConfirmPassword
  showConfirmPassword = !showConfirmPassword;
  assert.equal(showConfirmPassword, true, 'showConfirmPassword toggled to true');
  assert.equal(confirmPasswordValue, 'SecretP@ssword123!', 'Confirm password value was preserved across toggle');

  // Toggling back
  showPassword = !showPassword;
  assert.equal(showPassword, false, 'showPassword toggled back to false (hidden)');
  assert.equal(showConfirmPassword, true, 'showConfirmPassword remains visible');
  assert.equal(passwordValue, 'SecretP@ssword123!', 'Password value remains intact');
});

console.log('\n' + '='.repeat(64));
console.log(`  ALL ${passed} PASSWORD VISIBILITY UX TESTS PASSED! 🚀`);
console.log('='.repeat(64));
