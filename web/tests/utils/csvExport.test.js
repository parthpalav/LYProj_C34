/**
 * test_csv_export.js
 * 
 * Standalone unit test suite for CSV generation and formula injection prevention.
 * Verifies:
 *  1. Comma escaping
 *  2. Quote escaping (" -> "")
 *  3. Newline handling
 *  4. Unicode & Indian Rupee descriptions preservation
 *  5. Formula-injection prefix sanitization (=, +, -, @, \t, \r)
 *  6. Numeric amount preservation (raw numbers, no currency symbol strings)
 *  7. ISO date formatting
 *  8. UTF-8 BOM presence
 */

import assert from 'assert';

const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

function sanitizeCsvValue(val) {
  if (val === null || val === undefined) {
    return '';
  }

  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : '0';
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }

  if (val instanceof Date) {
    return val.toISOString();
  }

  let str = String(val);
  str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const hasFormulaPrefix = FORMULA_PREFIXES.some((prefix) => str.startsWith(prefix) || str.trimStart().startsWith(prefix));
  if (hasFormulaPrefix) {
    str = `'${str}`;
  }

  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function buildCsvContent(headers, rows) {
  const headerLine = headers.map(sanitizeCsvValue).join(',');
  const rowLines = rows.map((row) => row.map(sanitizeCsvValue).join(','));
  const csvBody = [headerLine, ...rowLines].join('\r\n');
  return `\uFEFF${csvBody}`;
}

function runCsvTests() {
  console.log('============================================================');
  console.log('  FINAURA CSV EXPORT & FORMULA SANITIZATION TEST SUITE');
  console.log('============================================================\n');

  // Test 1: Comma escaping
  process.stdout.write('Running Test 1: Comma escaping... ');
  assert.strictEqual(sanitizeCsvValue('Groceries, Snacks & Beverages'), '"Groceries, Snacks & Beverages"');
  console.log('✅ Passed');

  // Test 2: Double-quote escaping
  process.stdout.write('Running Test 2: Quote escaping (" -> "")... ');
  assert.strictEqual(sanitizeCsvValue('Dinner at "Bukhara" Delhi'), '"Dinner at ""Bukhara"" Delhi"');
  console.log('✅ Passed');

  // Test 3: Newlines inside text
  process.stdout.write('Running Test 3: Newline handling... ');
  assert.strictEqual(sanitizeCsvValue('Line 1\nLine 2'), '"Line 1\nLine 2"');
  console.log('✅ Passed');

  // Test 4: Unicode preservation
  process.stdout.write('Running Test 4: Unicode preservation (Hindi, Emoji, Accents)... ');
  const unicodeStr = 'किराना सामान 🛒 ₹500 Café';
  assert.strictEqual(sanitizeCsvValue(unicodeStr), unicodeStr);
  console.log('✅ Passed');

  // Test 5: Formula Injection Protection (=, +, -, @, \t, \r)
  process.stdout.write('Running Test 5: Formula Injection Protection... ');
  assert.strictEqual(sanitizeCsvValue('=SUM(A1:A10)'), "'=SUM(A1:A10)");
  assert.strictEqual(sanitizeCsvValue('+123456789'), "'+123456789");
  assert.strictEqual(sanitizeCsvValue('-5000'), "'-5000");
  assert.strictEqual(sanitizeCsvValue('@SUM(B1:B5)'), "'@SUM(B1:B5)");
  assert.strictEqual(sanitizeCsvValue('\tcmd|/C calc.exe'), "'\tcmd|/C calc.exe");
  assert.strictEqual(sanitizeCsvValue('  =1+1'), "'  =1+1");
  // If text starts with dangerous prefix and contains comma, it must be quote-wrapped as well:
  assert.strictEqual(sanitizeCsvValue('=HYPERLINK("http://evil.com", "Click")'), '"\'=HYPERLINK(""http://evil.com"", ""Click"")"');
  console.log('✅ Passed');

  // Test 6: Numeric Amount Preservation
  process.stdout.write('Running Test 6: Numeric amount preservation (raw numbers)... ');
  assert.strictEqual(sanitizeCsvValue(54200.5), '54200.5');
  assert.strictEqual(sanitizeCsvValue(0), '0');
  assert.strictEqual(sanitizeCsvValue(-100), '-100'); // numbers are not formula injected
  console.log('✅ Passed');

  // Test 7: ISO Date Output
  process.stdout.write('Running Test 7: ISO Date output... ');
  const testDate = new Date('2026-08-15T00:00:00.000Z');
  assert.strictEqual(sanitizeCsvValue(testDate), '2026-08-15T00:00:00.000Z');
  console.log('✅ Passed');

  // Test 8: UTF-8 BOM Presence & Row Serialization
  process.stdout.write('Running Test 8: UTF-8 BOM and CSV document structure... ');
  const headers = ['Date', 'Description', 'Amount'];
  const rows = [
    ['2026-08-15', 'Monthly Rent', 25000],
    ['2026-08-16', '=MALICIOUS()', 100],
    ['2026-08-17', 'Coffee, Bakery & Milk', 450]
  ];
  const csv = buildCsvContent(headers, rows);
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
  assert.ok(csv.includes("Date,Description,Amount\r\n"), 'Header line matches');
  assert.ok(csv.includes("2026-08-15,Monthly Rent,25000\r\n"), 'Normal row matches');
  assert.ok(csv.includes("2026-08-16,'=MALICIOUS(),100\r\n"), 'Formula injection sanitized');
  assert.ok(csv.includes('2026-08-17,"Coffee, Bakery & Milk",450'), 'Comma escaping matches');
  console.log('✅ Passed');

  console.log('\n============================================================');
  console.log('  ALL CSV EXPORT TESTS PASSED SUCCESSFULLY! 🚀');
  console.log('============================================================\n');
}

runCsvTests();
