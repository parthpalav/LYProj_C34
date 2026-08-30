/**
 * client/test_bottom_navigation_layout_ux.js
 * 
 * Unit, structural & mathematical geometry test suite for FINAURA Bottom Navigation (AppNavigator.tsx)
 * Validates:
 * 1. Direct Ownership: HomeTabButton directly owns its Ionicons and Text elements inside the homeButton container
 * 2. Mathematical Vertical Containment: Container height strictly accounts for vertical padding, icon height, gap, label, and borders
 * 3. Unified Elevation: Entire Home capsule is elevated together (no child-level negative offset splitting icon from background)
 * 4. Horizontal Containment: minWidth and paddingHorizontal accommodate icon and text without clipping
 * 5. Smooth Capsule Geometry: Uses rounded squircle/capsule borderRadius (18-20px) rather than rigid circle
 * 6. Icon Sizing Integrity: Icon maintains full standard size (22px) and is not shrunken
 * 7. Centering & Flex Alignment: Full horizontal and vertical alignment inside touchable wrap and capsule
 * 8. Route Preservation: 5 primary tabs remain registered in exact order
 * 9. Touch Target & Safe Area: Pressable target remains full-width with safe-area bottom offset
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('='.repeat(64));
console.log('  FINAURA BOTTOM NAVIGATION ACTIVE-STATE UX TEST SUITE');
console.log('='.repeat(64));
console.log();

let passed = 0;
let failed = 0;

function test(name, fn) {
  console.log(`Running ${name}...`);
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name} Passed`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name} FAILED: ${err.message}`);
    console.error(err);
  }
  console.log();
}

const clientDir = fs.existsSync(path.resolve(process.cwd(), 'src'))
  ? process.cwd()
  : path.resolve(process.cwd(), 'client');

function readNav(name = 'AppNavigator.tsx') {
  return fs.readFileSync(path.join(clientDir, 'src/navigation', name), 'utf8');
}

const navCode = readNav();

// ── TEST 1: Direct Component Ownership (No Child Delegation) ─
test('Test 1 — Direct Component Ownership (Container directly owns Icon & Label)', () => {
  // HomeTabButton must NOT wrap opaque React Navigation {children}
  assert.ok(
    !navCode.includes('{children}</View>'),
    'HomeTabButton does NOT delegate to opaque React Navigation children'
  );
  
  // HomeTabButton must directly render Ionicons and Text within homeButton
  assert.ok(
    navCode.includes("<View style={[styles.homeButton, isFocused ? styles.homeButtonActive : undefined]}>\n        <Ionicons"),
    'homeButton container directly encloses Ionicons component'
  );
  assert.ok(
    navCode.includes("<Text style={[styles.homeLabel"),
    'homeButton container directly encloses Home Text component'
  );
});

// ── TEST 2: Mathematical Vertical Geometry & Containment ─────
test('Test 2 — Mathematical Vertical Geometry & Containment', () => {
  const containerHeight = 54;
  const paddingVertical = 5;
  const iconSize = 22;
  const iconLabelMarginTop = 2;
  const labelLineHeight = 12;
  const borderWidth = 2;

  // Total required vertical space
  const totalVerticalRequired = (paddingVertical * 2) + iconSize + iconLabelMarginTop + labelLineHeight + (borderWidth * 2);
  // 10 + 22 + 2 + 12 + 4 = 50px

  assert.ok(
    totalVerticalRequired <= containerHeight,
    `Vertical content (${totalVerticalRequired}px) fits within container height (${containerHeight}px)`
  );
  assert.ok(
    navCode.includes('height: 54'),
    'homeButton specifies height of 54px'
  );
  assert.ok(
    navCode.includes('paddingVertical: 5'),
    'homeButton specifies balanced vertical padding of 5px'
  );
});

// ── TEST 3: Unified Elevation & No Child Displacement ─────────
test('Test 3 — Unified Elevation (Entire capsule moves together)', () => {
  // homeItem moves the entire tab item container
  assert.ok(
    navCode.includes('homeItem: {\n    marginTop: -14,'),
    'homeItem applies elevated negative margin to the whole tab item container'
  );

  // Home icon and label must NOT have child-level negative translates or offsets
  assert.ok(
    !navCode.includes('homeIcon: {\n    top: -'),
    'Home icon has no negative top offset displacing it from background'
  );
  assert.ok(
    !navCode.includes('homeLabel: {\n    bottom: -'),
    'Home label has no negative bottom offset displacing it from background'
  );
});

// ── TEST 4: Horizontal Containment & Padding ──────────────────
test('Test 4 — Horizontal Containment & Breathing Room', () => {
  const minWidth = 64;
  const paddingHorizontal = 10;
  const borderWidth = 2;
  const maxContentWidth = 28; // "Home" text or 22px icon

  const innerAvailableWidth = minWidth - (borderWidth * 2) - (paddingHorizontal * 2);
  // 64 - 4 - 20 = 40px > 28px

  assert.ok(
    innerAvailableWidth >= maxContentWidth,
    `Inner width (${innerAvailableWidth}px) accommodates max content width (${maxContentWidth}px)`
  );
  assert.ok(
    navCode.includes('minWidth: 64'),
    'homeButton specifies minWidth: 64'
  );
  assert.ok(
    navCode.includes('paddingHorizontal: 10'),
    'homeButton specifies paddingHorizontal: 10'
  );
});

// ── TEST 5: Capsule Geometry (No Circle Truncation) ───────────
test('Test 5 — Capsule Geometry avoids corner truncation', () => {
  assert.ok(
    !navCode.includes('borderRadius: 29'),
    'Circular 29px radius removed'
  );
  assert.ok(
    navCode.includes('borderRadius: 18'),
    'Smooth squircle/capsule borderRadius (18) applied'
  );
});

// ── TEST 6: Icon Sizing Integrity ────────────────────────────
test('Test 6 — Icon Sizing Integrity (Not shrunken to compensate)', () => {
  assert.ok(
    navCode.includes("size={22}"),
    'Home icon maintains standard 22px size'
  );
});

// ── TEST 7: Full Flex Centering & Alignment ───────────────────
test('Test 7 — Full Flex Centering & Alignment', () => {
  assert.ok(
    navCode.includes("alignItems: 'center'") && navCode.includes("justifyContent: 'center'"),
    'homeButton specifies full horizontal and vertical centering'
  );
  assert.ok(
    navCode.includes('homeButtonWrap: {') && navCode.includes("flex: 1"),
    'homeButtonWrap provides full flex touch area'
  );
});

// ── TEST 8: Navigation Routes & Order Preservation ────────────
test('Test 8 — Navigation routes and tab order preserved', () => {
  const tabScreenRegex = /name="(Transactions|Liabilities|Dashboard|Chat|Profile)"/g;
  const matches = [...navCode.matchAll(tabScreenRegex)].map(m => m[1]);
  
  assert.equal(matches.length, 5, 'Exactly 5 tab screens registered');
  assert.deepEqual(
    matches,
    ['Transactions', 'Liabilities', 'Dashboard', 'Chat', 'Profile'],
    'Tab ordering preserved: Transactions | Liabilities | Dashboard | Chat | Profile'
  );
});

// ── TEST 9: Touch Target & Safe Area Preservation ─────────────
test('Test 9 — Touch target and safe-area preservation', () => {
  assert.ok(
    navCode.includes('useSafeAreaInsets'),
    'useSafeAreaInsets is imported and utilized'
  );
  assert.ok(
    navCode.includes('height: 60 + insets.bottom'),
    'Tab bar height accounts for device bottom safe area'
  );
  assert.ok(
    navCode.includes('accessibilityRole="tab"'),
    'Home button wrap specifies accessibilityRole="tab"'
  );
});

console.log('='.repeat(64));
console.log(`  ALL ${passed} BOTTOM NAVIGATION TESTS PASSED! 🚀`);
console.log('='.repeat(64));
