// Regex SMS parser on real-format Indian bank messages (no DB, no network).
import '../setupEnv.js';
import assert from 'node:assert/strict';
import { parseBankSmsText } from '../../services/SmsParser.js';

const TZ = 'Asia/Kolkata';
const day = (d) => d && d.toLocaleDateString('en-CA', { timeZone: TZ });
let passed = 0;
const check = (name, sms, expected) => {
  const got = parseBankSmsText(sms, TZ);
  assert.ok(got, `${name}: not parsed`);
  for (const [k, v] of Object.entries(expected)) {
    const actual = k === 'date' ? day(got.date) : got[k];
    assert.equal(actual, v, `${name}: ${k} was ${actual}`);
  }
  passed += 1;
  console.log(`  ok  ${name}`);
};

check('HDFC UPI sent', 'Sent Rs.250.00\nFrom HDFC Bank A/C *1234\nTo SWIGGY\nOn 12/11/26\nRef 612345678901\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808',
  { amount: 250, direction: 'debit', merchant: 'SWIGGY', last4: '1234', date: '2026-11-12' });
check('HDFC card spend', 'Spent Rs.1299 On HDFC Bank Card 4321 At AMAZON PAY INDIA On 2026-11-12:10:22:33.Not You? To Block+Reissue Call 18002323232/SMS BLOCK CC 4321 to 7308080808',
  { amount: 1299, direction: 'debit', merchant: 'AMAZON PAY INDIA', last4: '4321', date: '2026-11-12' });
check('SBI UPI debit (no currency symbol)', 'Dear UPI user A/C X1234 debited by 450.0 on date 12Nov26 trf to ZOMATO Refno 612345678901. If not u? call 1800111109. -SBI',
  { amount: 450, direction: 'debit', merchant: 'ZOMATO', last4: '1234', date: '2026-11-12' });
check('SBI UPI credit', 'Dear SBI UPI User, ur A/cX1234 credited by Rs500 on 12Nov26 by  (Ref no 612345678901)',
  { amount: 500, direction: 'credit', last4: '1234' });
check('ICICI debit with payee "credited"', 'ICICI Bank Acct XX123 debited for Rs 240.00 on 12-Nov-26; BLINKIT credited. UPI:612345678901. Call 18002662 for dispute. SMS BLOCK 123 to 9215676766.',
  { amount: 240, direction: 'debit', merchant: 'BLINKIT', last4: '123', date: '2026-11-12' });
check('ICICI card spend, skips Avl Limit', 'INR 2,450.00 spent using ICICI Bank Card XX4321 on 12-Nov-26 on MYNTRA. Avl Limit: INR 1,52,550.00. If not you, call 1800 2662/SMS BLOCK 4321 to 9215676766',
  { amount: 2450, direction: 'debit', merchant: 'MYNTRA', last4: '4321' });
check('Axis UPI path merchant', 'INR 1500.00 debited\nA/c no. XX1234\n12-11-26, 10:15:22\nUPI/P2M/612345678901/UBER INDIA\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank',
  { amount: 1500, direction: 'debit', merchant: 'UBER INDIA', last4: '1234' });
check('Kotak to VPA', 'Sent Rs.120.00 from Kotak Bank AC X1234 to paytmqr@paytm on 12-11-26.UPI Ref 612345678901. Not you, https://kotak.com/KBANKT/Fraud',
  { amount: 120, direction: 'debit', merchant: 'paytmqr@paytm', upiId: 'paytmqr@paytm', last4: '1234' });
check('Salary NEFT credit, skips Avl Bal', 'Rs. 85,000.00 credited to A/c XX1234 on 01-Nov-26 by NEFT from ACME TECH PVT LTD. Avl Bal Rs 1,20,000.00 -HDFC Bank',
  { amount: 85000, direction: 'credit', merchant: 'ACME TECH PVT LTD', date: '2026-11-01' });

for (const [name, sms] of [
  ['OTP', '123456 is your OTP for txn of Rs 2,000.00 at AMAZON on HDFC Bank card 4321. Valid for 5 mins. Do not share'],
  ['mandate reminder', 'Rs 499 will be debited from your A/c XX1234 on 15-11-26 for NETFLIX mandate.'],
  ['promo', 'Congratulations! Get a pre-approved personal loan of Rs 5,00,000. Apply now'],
]) {
  assert.throws(() => parseBankSmsText(sms, TZ), (e) => e.code === 'NOT_TRANSACTION', name);
  passed += 1;
  console.log(`  ok  rejects ${name}`);
}
assert.equal(parseBankSmsText('hello there', TZ), null);
passed += 1;

console.log(`smsParser: ${passed} passed`);
