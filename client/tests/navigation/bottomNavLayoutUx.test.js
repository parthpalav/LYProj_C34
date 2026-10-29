/**
 * client/tests/navigation/bottomNavLayoutUx.test.js
 *
 * Structural checks for the floating glass tab bar (src/components/navigation/TabBar.tsx)
 * and how AppNavigator wires it:
 * 1. Four tab routes in order Home | Activity | Plan | AI, rendered through the custom TabBar
 * 2. Centre add button opens the QuickAdd sheet route
 * 3. Active-state: sliding pill indicator, accessible tab roles and selected state
 * 4. Safe area: bar offsets from the bottom inset; screens reserve space via useTabBarSpace
 * 5. Tab bar steps aside for the keyboard and when scrolling down
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('='.repeat(64));
console.log('  FINAURA BOTTOM NAVIGATION UX TEST SUITE');
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

const read = (rel) => fs.readFileSync(path.join(clientDir, rel), 'utf8');
const nav = read('src/navigation/AppNavigator.tsx');
const bar = read('src/components/navigation/TabBar.tsx');

test('Test 1 — Tab routes registered in order Home | Activity | Plan | AI', () => {
  const block = nav.slice(nav.indexOf('<Tab.Navigator'), nav.indexOf('</Tab.Navigator>'));
  const names = [...block.matchAll(/<Tab\.Screen name="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(names, ['Dashboard', 'Transactions', 'Plan', 'Chat']);
  assert.ok(block.includes("title: 'Home'") && block.includes("title: 'Activity'") && block.includes("title: 'AI'"), 'Tabs carry user-facing titles');
});

test('Test 2 — Custom floating TabBar is used', () => {
  assert.ok(nav.includes('tabBar={(props) => <TabBar {...props} />}'), 'Tab.Navigator renders TabBar');
  assert.ok(bar.includes("position: 'absolute'"), 'Bar floats above content');
  assert.ok(bar.includes('<BlurView'), 'Bar is frosted glass');
});

test('Test 3 — Centre add button opens QuickAdd', () => {
  assert.ok(bar.includes("navigation.navigate('QuickAdd'"), 'Add button navigates to QuickAdd');
  assert.ok(bar.includes('accessibilityLabel="Add a transaction"'), 'Add button is labelled');
  assert.ok(nav.includes('name="QuickAdd"') && nav.includes("presentation: 'formSheet'"), 'QuickAdd is a native form sheet route');
});

test('Test 4 — Tab labels and icons for each route', () => {
  for (const [route, label] of [['Dashboard', 'Home'], ['Transactions', 'Activity'], ['Plan', 'Plan'], ['Chat', 'AI']]) {
    assert.ok(bar.includes(`${route}: {`) && bar.includes(`label: '${label}'`), `${route} has label ${label}`);
  }
});

test('Test 5 — Active state: sliding pill and accessible tabs', () => {
  assert.ok(bar.includes('styles.pill'), 'Pill indicator rendered');
  assert.ok(bar.includes('withSpring(slotOf(state.index)'), 'Pill springs to the focused slot');
  assert.ok(bar.includes('accessibilityRole="tab"'), 'Items use the tab role');
  assert.ok(bar.includes('accessibilityState={{ selected: focused }}'), 'Selected state exposed');
  assert.ok(bar.includes("type: 'tabPress'"), 'tabPress events still emitted for listeners');
});

test('Test 6 — Safe area and content spacing', () => {
  assert.ok(bar.includes('useSafeAreaInsets'), 'Bar reads safe-area insets');
  assert.ok(bar.includes('export function useTabBarSpace'), 'Screens can reserve space under the bar');
  for (const screen of ['DashboardScreen.tsx', 'TransactionsScreen.tsx', 'PlanScreen.tsx', 'ChatScreen.tsx']) {
    assert.ok(read(`src/screens/${screen}`).includes('useTabBarSpace()'), `${screen} reserves bottom space`);
  }
});

test('Test 7 — Bar steps aside for keyboard and downward scroll', () => {
  assert.ok(bar.includes("'keyboardWillShow'") && bar.includes("'keyboardWillHide'"), 'Keyboard listeners hide/show the bar');
  assert.ok(bar.includes('export const tabBarHidden = makeMutable(0)'), 'Shared hidden state');
  assert.ok(read('src/components/ui/ScreenHeader.tsx').includes('tabBarHidden.value = withTiming(want'), 'Scroll direction drives the bar');
});

console.log('='.repeat(64));
console.log(failed ? `  ${failed} TEST(S) FAILED` : `  ALL ${passed} BOTTOM NAVIGATION TESTS PASSED! 🚀`);
console.log('='.repeat(64));
process.exit(failed ? 1 : 0);
