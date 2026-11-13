// Seeds the Mehta family demo (3 accounts, one family, history from 1 Nov 2025 to yesterday, auto-deduct bills,
// assets, payment methods and part-funded goals)
// through the real HTTP API, so every transaction is classified by the live ML service.
//
// Needs: MongoDB, the server (:4000) and ml-service (:5001) running.
//   node scripts/seedDemoFamily.js --probe   classify every description, write nothing
//   node scripts/seedDemoFamily.js --reset   delete the 3 demo accounts and their data, then seed
//   node scripts/seedDemoFamily.js           seed (refuses if the accounts already exist)
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import Goal from '../models/Goal.js';
import Family from '../models/Family.js';
import FamilyInvitation from '../models/FamilyInvitation.js';
import FMIHistory from '../models/FMIHistory.js';
import Liability from '../models/Liability.js';
import RefreshToken from '../models/RefreshToken.js';
import EmailVerificationToken from '../models/EmailVerificationToken.js';
import Asset from '../models/Asset.js';
import PaymentMethod from '../models/PaymentMethod.js';
import AgentMemory from '../models/AgentMemory.js';
import Alert from '../models/Alert.js';
import Envelope from '../models/Envelope.js';
import MerchantPreference from '../models/MerchantPreference.js';

const API = process.env.DEMO_API_URL || 'http://localhost:4000';
const ML = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const PASSWORD = 'Demo#2026';

// Deterministic PRNG so re-seeding gives the same history
let seed = 20261104;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const between = (lo, hi, step = 10) => Math.round((lo + rand() * (hi - lo)) / step) * step;
const at = (date, time) => `${date}T${time}:00+05:30`; // IST wall clock
const days = (from, to) => {
  const out = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};
const dow = (date) => new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
// History runs to yesterday (IST) so the weekly report and "today" predictions are never empty on demo day.
// shortcut: monthly items (SIPs, salary) are only written up to November 2026, re-date FULL_MONTHS if demoing later.
const YESTERDAY = new Date(Date.now() + 5.5 * 3600000 - 86400000).toISOString().slice(0, 10);
const HANDWRITTEN_END = '2026-11-03';
const ALL_DAYS = days('2025-11-01', YESTERDAY > HANDWRITTEN_END ? YESTERDAY : HANDWRITTEN_END);

// Full calendar months of history, then the hand-written entries for 1-3 Nov 2026
const FULL_MONTHS = [];
for (let y = 2025, m = 11; !(y === 2026 && m === 11); m === 12 ? (y++, m = 1) : m++) {
  FULL_MONTHS.push(`${y}-${String(m).padStart(2, '0')}`);
}
const lastDay = (ym) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
const on = (ym, day) => `${ym}-${String(Math.min(day, lastDay(ym))).padStart(2, '0')}`;
const monthName = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
const pick = (list) => list[Math.floor(rand() * list.length)];
const anyDay = (ym) => on(ym, 2 + Math.floor(rand() * 26));
// Habit generators stop where the hand-written November entries take over
const HABIT_DAYS = ALL_DAYS.filter((d) => d < '2026-11-01' || d > HANDWRITTEN_END);
const monthlyIncome = (amount, source, label) =>
  [...FULL_MONTHS, '2026-11'].map((ym) => [on(ym, 1), amount, source, `${monthName(ym)} ${label}`]);

// ── Rajesh Mehta (dad, 52, Senior GM at a pharma company, Andheri) ──────────
function rajesh() {
  const t = [];
  for (const ym of FULL_MONTHS) {
    const mon = monthName(ym);
    const m = +ym.slice(5);
    t.push(
      // Monthly investments and bills
      [on(ym, 1), '09:15', 25000, 'SIP Parag Parikh Flexi Cap Fund'],
      [on(ym, 2), '09:20', 15000, 'SIP HDFC Mid-Cap Opportunities Fund'],
      [on(ym, 3), '10:05', 10000, 'NPS Tier 1 contribution'],
      [on(ym, 5), '08:00', 12500, 'PPF deposit SBI'],
      [on(ym, 5), '07:30', 52000, 'Home loan EMI HDFC Bank'],
      [on(ym, 7), '11:40', 6800, `Society maintenance ${mon.slice(0, 3)} - Lokhandwala Heights`],
      [on(ym, 9), '20:15', between(3800, 6400), 'Adani Electricity bill'],
      [on(ym, 12), '21:00', 1178, 'Airtel Xstream fiber broadband bill'],
      [on(ym, 14), '21:05', 999, 'Jio postpaid family plan bill'],
      [on(ym, 18), '19:30', between(820, 1100), 'Mahanagar Gas bill'],
      [on(ym, 28), '08:10', 480, 'Times of India newspaper monthly bill'],
      [on(ym, 31), '19:00', 20000, `Driver salary ${mon}`],
      [on(ym, 11 + Math.floor(rand() * 4)), '11:15', 450, 'Haircut at barber'],
    );
    if ([1, 4, 7, 10].includes(m)) t.push([on(ym, 15), '12:30', 8600, 'LIC jeevan anand premium']);
    if (m % 2 === 0) t.push([on(ym, 10), '18:20', between(1700, 2100), 'Apollo pharmacy BP and diabetes medicines']);
    if (ym !== '2026-10') {
      for (let k = 0; k < 2; k++) {
        const [lo, hi, desc] = pick([
          [2500, 4800, 'Amazon order household items'],
          [1200, 1800, 'Dr Shah consultation fee'],
          [2800, 4500, 'Honda City car service'],
          [2000, 6000, 'Croma electronics accessories'],
          [1500, 3500, 'Gifts for relatives'],
        ]);
        t.push([anyDay(ym), '17:30', between(lo, hi), desc]);
      }
    }
  }
  // October 2026: festive one-offs
  t.push(
    ['2026-10-17', '16:40', 3499, 'Amazon formal shoes'],
    ['2026-10-20', '10:00', 14200, 'Car insurance renewal Honda City - ICICI Lombard'],
    ['2026-10-20', '10:30', 2400, 'Puja samagri for Dussehra'],
    ['2026-10-22', '09:30', 1500, 'Dr Shah consultation fee'],
    ['2026-10-25', '12:00', 3800, 'Honda City car service'],
    ['2026-10-27', '18:50', 9500, 'Diwali gift hampers for office team'],
    ['2026-10-29', '20:30', 1299, 'Amazon Prime annual renewal'],
  );
  // November so far
  t.push(
    ['2026-11-01', '09:10', 25000, 'SIP Parag Parikh Flexi Cap Fund'],
    ['2026-11-01', '11:30', 2150, 'Breakfast at Kala Ghoda Cafe with family'],
    ['2026-11-02', '09:25', 15000, 'SIP HDFC Mid-Cap Opportunities Fund'],
    ['2026-11-02', '08:40', 3650, 'Petrol HP pump Andheri'],
    ['2026-11-02', '08:45', 1000, 'FASTag recharge'],
    ['2026-11-03', '10:00', 10000, 'NPS Tier 1 contribution'],
    ['2026-11-03', '19:40', 2600, 'Kaju katli and sweets for Diwali - Brijwasi'],
  );
  HABIT_DAYS.forEach((d, i) => {
    const day = dow(d);
    if ([1, 2, 3, 4, 5].includes(day) && rand() < 0.45) t.push([d, '13:20', between(220, 420), 'Lunch at office canteen']);
    if ([1, 3, 5].includes(day) && rand() < 0.35) t.push([d, '17:10', between(60, 140), 'Tea and snacks']);
    // Petrol roughly every 8 days; FASTag is usually topped up at the same stop
    if (i % 8 === 2) {
      t.push([d, '08:40', between(3200, 4100), 'Petrol HP pump Andheri']);
      if (rand() < 0.6) t.push([d, '08:45', 1000, 'FASTag recharge']);
    }
    // Thursday client dinners end with an Uber home
    if (day === 4 && rand() < 0.3) {
      t.push([d, '21:30', between(5500, 8500), `${pick(['Bastian Bandra', 'Ziya Oberoi', 'Masala Library'])} client dinner`]);
      if (rand() < 0.85) t.push([d, '23:10', between(380, 620), 'Uber ride home from dinner']);
    }
    // Sunday family lunch, often followed by mall shopping
    if (day === 0 && rand() < 0.45) {
      t.push([d, '13:30', between(3200, 5200), `${pick(['Mainland China', 'Copper Chimney', 'Global Fusion'])} family lunch`]);
      if (rand() < 0.6) t.push([d, '16:30', between(1800, 5500), 'Infiniti Mall shopping']);
    }
  });
  return t;
}

// ── Kavita Mehta (mum, 48, HR Manager at an IT firm, Powai; runs the household) ──
function kavita() {
  const t = [];
  for (const ym of FULL_MONTHS) {
    const mon = monthName(ym);
    t.push(
      [on(ym, 2), '10:00', 12000, 'SIP Mirae Asset Large Cap Fund'],
      [on(ym, 3), '10:15', 8000, 'Recurring deposit SBI'],
      [on(ym, 4), '08:30', 2500, 'Yoga class monthly fee'],
      [on(ym, 6), '20:00', 649, 'Netflix subscription'],
      [on(ym, 8), '19:00', 710, 'Tata Play DTH recharge'],
      [on(ym, 31), '10:00', 9000, `Maid salary ${mon}`],
      [on(ym, 31), '10:05', 12000, `Cook salary ${mon}`],
      [on(ym, 31), '17:30', between(8500, 10500), 'DMart monthly grocery stock'],
      [on(ym, 31), '08:00', between(2900, 3300), 'Gokul milk monthly bill'],
    );
    if (ym !== '2026-10') {
      for (let k = 0; k < 2 + Math.floor(rand() * 2); k++) {
        const [lo, hi, desc] = pick([
          [2800, 4200, 'Lakme salon haircut and facial'],
          [1800, 2800, "Nature's Basket fruits and dry fruits"],
          [1200, 2400, 'Dentist appointment Dr Kulkarni'],
          [1800, 4500, 'Westside kurta shopping'],
          [900, 1600, 'Lunch with colleagues at Smoke House Deli'],
        ]);
        t.push([anyDay(ym), '16:00', between(lo, hi), desc]);
      }
    }
  }
  // October 2026: Navratri and Diwali
  t.push(
    ['2026-10-10', '17:30', 2480, "Nature's Basket fruits and dry fruits"],
    ['2026-10-12', '19:15', 1500, 'Navratri garba passes'],
    ['2026-10-14', '15:20', 6800, 'Chaniya choli shopping for Navratri'],
    ['2026-10-17', '16:00', 3850, 'Lakme salon haircut and facial'],
    ['2026-10-19', '11:00', 1101, 'Siddhivinayak temple donation'],
    ['2026-10-21', '18:00', 1800, 'Dentist appointment Dr Kulkarni'],
    ['2026-10-23', '16:45', 14500, 'Silk saree from Nalli for Diwali'],
    ['2026-10-25', '17:30', 2850, 'Diwali diyas lanterns and fairy lights'],
    ['2026-10-26', '18:10', 6200, 'Diwali gifts for relatives'],
    ['2026-10-28', '12:30', 1450, 'Lunch with colleagues at Smoke House Deli'],
    ['2026-10-31', '19:30', 380, 'Rangoli colours'],
  );
  // November so far
  t.push(
    ['2026-11-02', '09:45', 12000, 'SIP Mirae Asset Large Cap Fund'],
    ['2026-11-03', '10:10', 8000, 'Recurring deposit SBI'],
    ['2026-11-03', '11:00', 2000, 'Digital gold purchase on PhonePe'],
    ['2026-11-01', '09:00', 820, 'Vegetables from sabzi mandi'],
    ['2026-11-02', '18:40', 560, 'Zepto order milk bread eggs'],
    ['2026-11-03', '08:30', 240, 'Flowers for puja'],
  );
  for (const d of HABIT_DAYS) {
    const day = dow(d);
    if (day === 0 || day === 3) t.push([d, '09:00', between(550, 950), 'Vegetables from sabzi mandi']);
    if (rand() < 0.3) t.push([d, '18:40', between(280, 900), 'Zepto order milk bread eggs']);
    if (day === 6 && rand() < 0.6) t.push([d, '17:00', between(350, 650), 'Fruits from local vendor']);
    // Saturday BigBasket order, usually with a pharmacy run and sometimes skincare
    if (day === 6 && rand() < 0.75) {
      t.push([d, '11:30', between(1800, 3200), 'BigBasket weekly groceries']);
      if (rand() < 0.55) t.push([d, '12:15', between(250, 900), 'Wellness Forever pharmacy']);
      if (rand() < 0.35) t.push([d, '20:30', between(700, 1800), 'Nykaa skincare order']);
    }
  }
  return t;
}

// ── Aarav Mehta (son, 21, final-year B.Tech, pocket money only) ────────────
function aarav() {
  const t = [];
  for (const ym of FULL_MONTHS) {
    t.push(
      [on(ym, 2), '10:30', 1000, 'SIP Nifty 50 index fund on Groww'],
      [on(ym, 3), '11:00', 650, 'Local train student pass'],
      [on(ym, 5), '09:00', 1500, 'Gym membership monthly'],
      [on(ym, 5), '22:15', 59, 'Spotify premium student'],
      [on(ym, 7), '12:00', 349, 'Jio prepaid recharge'],
      [on(ym, 26), '12:30', 300, 'Haircut'],
    );
    if (ym !== '2026-10' && rand() < 0.8) {
      const [lo, hi, desc] = pick([
        [449, 549, 'Udemy machine learning course'],
        [999, 1599, 'Myntra hoodie'],
        [799, 1299, 'Amazon wireless earbuds sale'],
        [600, 1200, 'Birthday gift for friend'],
        [200, 350, 'Notebook and stationery'],
      ]);
      t.push([anyDay(ym), '15:30', between(lo, hi), desc]);
    }
  }
  // October 2026 one-offs
  t.push(
    ['2026-10-09', '15:30', 499, 'Udemy machine learning course'],
    ['2026-10-13', '20:00', 500, 'Garba night entry with friends'],
    ['2026-10-15', '16:20', 1499, 'Myntra hoodie'],
    ['2026-10-22', '18:30', 1200, 'Birthday gift for friend'],
  );
  // November so far
  t.push(
    ['2026-11-02', '10:20', 1000, 'SIP Nifty 50 index fund on Groww'],
    ['2026-11-01', '23:40', 460, 'Zomato order'],
    ['2026-11-02', '14:10', 280, 'Uber ride to Bandra'],
    ['2026-11-02', '18:45', 640, 'PVR movie tickets'],
    ['2026-11-03', '01:10', 380, 'Swiggy Instamart chips and cold drinks'],
    ['2026-11-03', '11:30', 150, 'Chai and maggi at college canteen'],
    ['2026-11-03', '17:20', 420, 'Starbucks cold coffee'],
  );
  for (const d of HABIT_DAYS) {
    const day = dow(d);
    const weekday = [1, 2, 3, 4, 5].includes(day);
    if (weekday && rand() < 0.55) t.push([d, '11:30', between(80, 200), 'Chai and maggi at college canteen']);
    if (weekday && rand() < 0.3) t.push([d, '09:10', between(120, 260), 'Rapido bike taxi to college']);
    if (rand() < 0.18) t.push([d, rand() < 0.4 ? '23:35' : '20:40', between(250, 560), rand() < 0.5 ? 'Swiggy order' : 'Zomato order']);
    if (rand() < 0.1) t.push([d, '17:20', between(320, 480), 'Starbucks cold coffee']);
    // Friday / Saturday nights out: Uber in, usually a movie, often dinner with friends
    if ((day === 5 || day === 6) && rand() < 0.45) {
      t.push([d, '18:10', between(180, 420), 'Uber ride to Bandra']);
      if (rand() < 0.7) t.push([d, '19:00', between(450, 800), 'PVR movie tickets']);
      if (rand() < 0.6) t.push([d, '21:15', between(700, 1100), 'Social Andheri dinner with friends']);
    }
    // Late-night gaming top-up, then snacks from Instamart
    if (rand() < 0.04) {
      t.push([d, '23:50', between(400, 900), 'Valorant points top-up']);
      if (rand() < 0.7) t.push([d, '23:58', between(200, 420), 'Swiggy Instamart chips and cold drinks']);
    }
  }
  return t;
}

// Auto-deduct bills, created from today so the scheduler only charges future dues
const bill = (name, amount, category, type, schedule, extra = {}) => ({ name, amount, category, type, autoDeduct: true, frequency: 'monthly', ...schedule, ...extra });

// Market assets carry a value; FD/RD carry deposit details and the server works out the value
const asset = (name, assetType, currentValue, ratePct, extra = {}) => ({ name, assetType, assetClass: 'FIRE_INVESTABLE', currentValue, annualReturnRate: ratePct, liquidity: 'liquid', includedInFireCorpus: true, ...extra });
const fd = (name, principal, ratePct, startDate, tenureMonths) => ({ name, assetType: 'Fixed Deposit', assetClass: 'SEMI_LIQUID', principal, annualReturnRate: ratePct, startDate: `${startDate}T00:00:00+05:30`, tenureMonths, liquidity: 'locked', includedInFireCorpus: false });

const PEOPLE = [
  {
    key: 'rajesh', name: 'Rajesh Mehta', email: 'rajesh.mehta@example.com',
    profile: { dateOfBirth: '1974-06-12', retirementAge: 60, monthlyIncome: 240000, currentBalance: 6200000, incomeType: 'salaried' },
    goals: [
      { name: 'Retirement corpus', emoji: '🏖️', targetAmount: 15000000, targetDate: '2034-06-12', monthlyContribution: 50000, savedAmount: 6150000 },
      { name: 'Aarav\'s Masters abroad', emoji: '🎓', targetAmount: 4000000, targetDate: '2028-08-01', monthlyContribution: 40000, savedAmount: 1450000 },
    ],
    methods: [
      { kind: 'upi', nickname: 'GPay - HDFC', upiId: 'rajesh.mehta@okhdfcbank' },
      { kind: 'credit_card', nickname: 'HDFC Regalia', last4: '4821', creditLimit: 500000, statementDay: 18, dueDay: 5, used: 46800, billedUnpaid: 18250 },
      { kind: 'debit_card', nickname: 'HDFC Debit', last4: '7730' },
    ],
    assets: [
      asset('Parag Parikh Flexi Cap Fund', 'Mutual Fund', 2350000, 13, { monthlyContribution: 25000 }),
      asset('HDFC Mid-Cap Opportunities Fund', 'Mutual Fund', 1420000, 14, { monthlyContribution: 15000 }),
      asset('NPS Tier 1', 'Provident Fund / PPF', 1680000, 10, { monthlyContribution: 10000, liquidity: 'restricted' }),
      asset('EPF - Sun Pharma', 'Provident Fund / PPF', 2900000, 8.25, { liquidity: 'restricted' }),
      asset('Direct equity - Zerodha', 'Equity', 860000, 12),
      fd('SBI Fixed Deposit', 800000, 7.1, '2025-08-10', 24),
      asset('Emergency fund - HDFC savings', 'Cash & Bank', 900000, 3, { assetClass: 'SEMI_LIQUID', includedInFireCorpus: false }),
      asset('Flat - Lokhandwala Heights', 'Real Estate', 21000000, 5, { assetClass: 'NON_INVESTABLE', liquidity: 'locked', includedInFireCorpus: false }),
    ],
    income: monthlyIncome(240000, 'salary', 'salary - Sun Pharma'),
    tx: rajesh,
    bills: [
      bill('Home loan EMI HDFC Bank', 52000, 'Debt & Loan Payments', 'Need', { dayOfMonth: 5 }, { outstandingBalance: 3800000, interestRate: 8.5, remainingTermMonths: 96 }),
      bill('Society maintenance - Lokhandwala Heights', 6800, 'Housing', 'Need', { dayOfMonth: 7 }),
      bill('Airtel Xstream fiber broadband', 1178, 'Utilities & Bills', 'Need', { dayOfMonth: 12 }),
      bill('Driver salary', 20000, 'Transport & Travel', 'Need', { dayOfMonth: 30 }),
      bill('Car wash weekly', 300, 'Transport & Travel', 'Need', { frequency: 'weekly', dayOfWeek: 0 }),
    ],
  },
  {
    key: 'kavita', name: 'Kavita Mehta', email: 'kavita.mehta@example.com',
    profile: { dateOfBirth: '1978-03-22', retirementAge: 58, monthlyIncome: 130000, currentBalance: 3900000, incomeType: 'salaried' },
    goals: [
      { name: 'Retirement fund', emoji: '🌴', targetAmount: 7500000, targetDate: '2036-03-22', monthlyContribution: 20000, savedAmount: 2380000 },
      { name: 'Family Kerala trip', emoji: '✈️', targetAmount: 250000, targetDate: '2027-05-01', monthlyContribution: 15000, savedAmount: 165000 },
    ],
    methods: [
      { kind: 'upi', nickname: 'PhonePe - ICICI', upiId: 'kavita.mehta@icici' },
      { kind: 'credit_card', nickname: 'ICICI Amazon Pay', last4: '9054', creditLimit: 200000, statementDay: 12, dueDay: 30, used: 14200, billedUnpaid: 0 },
    ],
    assets: [
      asset('Mirae Asset Large Cap Fund', 'Mutual Fund', 1120000, 12, { monthlyContribution: 12000 }),
      asset('PPF - SBI', 'Provident Fund / PPF', 1260000, 7.1, { liquidity: 'restricted' }),
      asset('Gold jewellery and coins', 'Gold', 950000, 8, { assetClass: 'SEMI_LIQUID', includedInFireCorpus: false }),
      { name: 'ICICI Recurring Deposit', assetType: 'Recurring Deposit', assetClass: 'SEMI_LIQUID', monthlyContribution: 10000, annualReturnRate: 6.8, startDate: '2026-01-05T00:00:00+05:30', tenureMonths: 24, liquidity: 'locked', includedInFireCorpus: false },
      asset('Household buffer - ICICI savings', 'Cash & Bank', 450000, 3, { assetClass: 'SEMI_LIQUID', includedInFireCorpus: false }),
    ],
    income: monthlyIncome(130000, 'salary', 'salary - Infosys Powai'),
    tx: kavita,
    bills: [
      bill('Yoga class monthly fee', 2500, 'Health', 'Want', { dayOfMonth: 4 }),
      bill('Netflix subscription', 649, 'Entertainment', 'Want', { dayOfMonth: 6 }),
      bill('Maid salary', 9000, 'Housing', 'Need', { dayOfMonth: 30 }),
      bill('Cook salary', 12000, 'Housing', 'Need', { dayOfMonth: 30 }),
    ],
  },
  {
    key: 'aarav', name: 'Aarav Mehta', email: 'aarav.mehta@example.com',
    profile: { dateOfBirth: '2005-08-14', retirementAge: 60, monthlyIncome: 18000, currentBalance: 42000, incomeType: 'student' },
    goals: [
      { name: 'MacBook Air', emoji: '💻', targetAmount: 115000, targetDate: '2027-06-01', monthlyContribution: 3000, savedAmount: 48000 },
    ],
    methods: [{ kind: 'upi', nickname: 'Paytm', upiId: 'aarav.mehta@paytm' }],
    assets: [
      asset('Nifty 50 index fund SIP', 'Mutual Fund', 14500, 12, { monthlyContribution: 1000 }),
      asset('Savings account - Kotak 811', 'Cash & Bank', 22000, 3.5, { assetClass: 'SEMI_LIQUID', includedInFireCorpus: false }),
    ],
    income: monthlyIncome(18000, 'pocket money', 'pocket money from Papa'),
    tx: aarav,
    bills: [
      bill('Gym membership', 1500, 'Health', 'Want', { dayOfMonth: 5 }),
      bill('Spotify premium student', 59, 'Entertainment', 'Want', { dayOfMonth: 5 }),
      bill('Jio prepaid recharge', 349, 'Utilities & Bills', 'Need', { dayOfMonth: 7 }),
    ],
  },
];

async function call(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}
// Server ids are `x-${Date.now()}`; keep writes ≥2 ms apart so they never collide
const tick = () => new Promise((r) => setTimeout(r, 3));

async function probe() {
  const seen = new Map();
  for (const p of PEOPLE) for (const [, , , desc] of p.tx()) seen.set(desc, p.key);
  for (const [desc, who] of seen) {
    const r = await fetch(`${ML}/classify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: desc }) }).then((x) => x.json());
    console.log(`${who.padEnd(7)} ${r.type.padEnd(10)} ${r.category.padEnd(20)} ${r.confidence.toFixed(2)}${r.needsReview ? ' REVIEW' : '       '} ${desc}`);
  }
}

async function reset() {
  const users = await User.find({ email: { $in: PEOPLE.map((p) => p.email) } }).lean();
  const ids = users.map((u) => u.id);
  if (!ids.length) return;
  await Promise.all([
    Transaction.deleteMany({ userId: { $in: ids } }),
    Income.deleteMany({ userId: { $in: ids } }),
    Goal.deleteMany({ userId: { $in: ids } }),
    FMIHistory.deleteMany({ userId: { $in: ids } }),
    Liability.deleteMany({ userId: { $in: ids } }),
    Family.deleteMany({ 'members.userId': { $in: ids } }),
    FamilyInvitation.deleteMany({ $or: [{ inviterUserId: { $in: ids } }, { inviteeUserId: { $in: ids } }] }),
    RefreshToken.deleteMany({ userId: { $in: ids } }),
    EmailVerificationToken.deleteMany({ userId: { $in: ids } }),
    Asset.deleteMany({ userId: { $in: ids } }),
    PaymentMethod.deleteMany({ userId: { $in: ids } }),
    AgentMemory.deleteMany({ userId: { $in: ids } }),
    Alert.deleteMany({ userId: { $in: ids } }),
    Envelope.deleteMany({ userId: { $in: ids } }),
    MerchantPreference.deleteMany({ userId: { $in: ids } }),
  ]);
  await User.deleteMany({ id: { $in: ids } });
  console.log(`Reset: removed ${ids.length} demo accounts`);
}

async function seedAll() {
  const existing = await User.countDocuments({ email: { $in: PEOPLE.map((p) => p.email) } });
  if (existing) throw new Error('Demo accounts already exist. Re-run with --reset to rebuild them.');

  for (const p of PEOPLE) {
    const reg = await call('POST', '/api/auth/register', null, { name: p.name, email: p.email, password: PASSWORD, incomeType: p.profile.incomeType });
    p.token = reg.accessToken;
    p.id = reg.user.id;
    await tick();
    await call('POST', '/api/user/onboarding', p.token, p.profile);
    // Demo accounts skip the email link
    await User.updateOne({ id: p.id }, { isEmailVerified: true });
    for (const { savedAmount, ...g } of p.goals) {
      const goal = await call('POST', '/api/goals', p.token, g);
      if (savedAmount) await call('PUT', `/api/goals/${goal.id || goal._id}`, p.token, { savedAmount });
      await tick();
    }
    let upiId = 'cash';
    for (const m of p.methods || []) {
      const made = await call('POST', '/api/payment-methods', p.token, m);
      if (m.kind === 'upi') upiId = made.data.id;
      await tick();
    }
    for (const a of p.assets || []) { await call('POST', '/api/assets', p.token, a); await tick(); }
    for (const [date, amount, source, description] of p.income) {
      await call('POST', '/api/income', p.token, { amount, source, description, timestamp: at(date, '09:00') });
      await tick();
    }
    const txs = p.tx().sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
    for (const [date, time, amount, description] of txs) {
      // No category sent: the live classifier labels every entry, as on the mobile app
      // Older history is cash; entries after the hand-written block go through UPI so "Paid with" has something to show
      await call('POST', '/api/transactions', p.token, { amount, description, timestamp: at(date, time), paymentMethodId: date > HANDWRITTEN_END ? upiId : 'cash' });
      await tick();
    }
    for (const b of p.bills) {
      await call('POST', '/api/liabilities', p.token, { ...b, startDate: new Date().toISOString() });
      await tick();
    }
    console.log(`${p.name}: ${txs.length} transactions, ${p.income.length} incomes, ${p.goals.length} goals, ${p.bills.length} auto-deduct bills, ${(p.assets || []).length} assets, ${(p.methods || []).length} payment methods`);
  }

  // Rajesh creates the family by inviting the others; they accept
  const [dad, ...rest] = PEOPLE;
  for (const p of rest) {
    await call('POST', '/api/family/invitations', dad.token, { email: p.email });
    const received = await call('GET', '/api/family/invitations/received', p.token);
    const list = received.invitations || received.data || received;
    const inv = list.find((i) => i.status === 'pending') || list[0];
    await call('POST', `/api/family/invitations/${inv.id || inv._id}/accept`, p.token);
  }
  await Family.updateOne({ ownerUserId: dad.id, isActive: true }, { name: 'Mehta Family' });

  for (const p of PEOPLE) {
    const fmi = await call('GET', '/api/fmi', p.token);
    console.log(`Personal FMI ${p.name}: ${fmi.score} (${fmi.fmiLabel})`);
  }
  const fam = await call('GET', '/api/family/dashboard', dad.token);
  const famFmi = fam.familyFmi || fam.fmi || fam.data?.familyFmi;
  console.log('Family FMI:', famFmi ? `${famFmi.score} (${famFmi.fmiLabel})` : JSON.stringify(Object.keys(fam)));
  for (const m of fam.memberBreakdown?.members || []) console.log(`  ${m.name}: ${m.score.points} points (${m.score.pctOfScore}%)`);
  for (const p of PEOPLE) {
    const pred = await call('GET', '/api/predictions/purchases', p.token);
    console.log(`Apriori ${p.name}: ${pred.data.available ? `${pred.data.rules.length} rules, top: ${pred.data.rules[0] ? `${pred.data.rules[0].antecedent.join(' + ')} -> ${pred.data.rules[0].consequent}` : 'none'}` : pred.data.reason}`);
  }
}

async function main() {
  if (process.argv.includes('--probe')) return probe();
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lyproj');
  try {
    if (process.argv.includes('--reset')) await reset();
    await seedAll();
    console.log(`\nLogins (password ${PASSWORD}):\n${PEOPLE.map((p) => `  ${p.email}`).join('\n')}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
