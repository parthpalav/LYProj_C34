// Seeds the Mehta family demo (3 accounts, one family, Oct 1 – Nov 3 2026 history)
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
import RefreshToken from '../models/RefreshToken.js';
import EmailVerificationToken from '../models/EmailVerificationToken.js';

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
const ALL_DAYS = days('2026-10-01', '2026-11-03');

// ── Rajesh Mehta (dad, 52, Senior GM at a pharma company, Andheri) ──────────
function rajesh() {
  const t = [
    // Monthly investments and bills
    ['2026-10-01', '09:15', 25000, 'SIP Parag Parikh Flexi Cap Fund'],
    ['2026-10-02', '09:20', 15000, 'SIP HDFC Mid-Cap Opportunities Fund'],
    ['2026-10-03', '10:05', 10000, 'NPS Tier 1 contribution'],
    ['2026-10-05', '08:00', 12500, 'PPF deposit SBI'],
    ['2026-10-05', '07:30', 52000, 'Home loan EMI HDFC Bank'],
    ['2026-10-07', '11:40', 6800, 'Society maintenance Oct - Lokhandwala Heights'],
    ['2026-10-09', '20:15', 5240, 'Adani Electricity bill'],
    ['2026-10-12', '21:00', 1178, 'Airtel Xstream fiber broadband bill'],
    ['2026-10-14', '21:05', 999, 'Jio postpaid family plan bill'],
    ['2026-10-15', '12:30', 8600, 'LIC jeevan anand premium'],
    ['2026-10-18', '19:30', 960, 'Mahanagar Gas bill'],
    ['2026-10-20', '10:00', 14200, 'Car insurance renewal Honda City - ICICI Lombard'],
    ['2026-10-31', '19:00', 20000, 'Driver salary October'],
    ['2026-10-30', '08:10', 480, 'Times of India newspaper monthly bill'],
    // Lifestyle and one-offs
    ['2026-10-04', '13:30', 4350, 'Sunday lunch with family at Mainland China'],
    ['2026-10-10', '18:20', 1890, 'Apollo pharmacy BP and diabetes medicines'],
    ['2026-10-11', '11:15', 450, 'Haircut at barber'],
    ['2026-10-16', '21:30', 7800, 'Client dinner at Bastian Bandra'],
    ['2026-10-17', '16:40', 3499, 'Amazon formal shoes'],
    ['2026-10-20', '10:30', 2400, 'Puja samagri for Dussehra'],
    ['2026-10-22', '09:30', 1500, 'Dr Shah consultation fee'],
    ['2026-10-25', '12:00', 3800, 'Honda City car service'],
    ['2026-10-27', '18:50', 9500, 'Diwali gift hampers for office team'],
    ['2026-10-29', '20:30', 1299, 'Amazon Prime annual renewal'],
    // November so far
    ['2026-11-01', '09:10', 25000, 'SIP Parag Parikh Flexi Cap Fund'],
    ['2026-11-01', '11:30', 2150, 'Breakfast at Kala Ghoda Cafe with family'],
    ['2026-11-02', '09:25', 15000, 'SIP HDFC Mid-Cap Opportunities Fund'],
    ['2026-11-03', '10:00', 10000, 'NPS Tier 1 contribution'],
    ['2026-11-03', '19:40', 2600, 'Kaju katli and sweets for Diwali - Brijwasi'],
  ];
  // Petrol roughly every 8 days, FASTag top-ups, office lunches, tea
  for (const d of ['2026-10-03', '2026-10-11', '2026-10-19', '2026-10-27', '2026-11-02']) {
    t.push([d, '08:40', between(3200, 4100), 'Petrol HP pump Andheri']);
  }
  for (const d of ['2026-10-06', '2026-10-21']) t.push([d, '08:30', 1000, 'FASTag recharge']);
  for (const d of ALL_DAYS) {
    if ([1, 2, 3, 4, 5].includes(dow(d)) && rand() < 0.45 && d < '2026-11-01') {
      t.push([d, '13:20', between(220, 420), 'Lunch at office canteen']);
    }
    if ([1, 3, 5].includes(dow(d)) && rand() < 0.35 && d < '2026-11-01') {
      t.push([d, '17:10', between(60, 140), 'Tea and snacks']);
    }
  }
  return t;
}

// ── Kavita Mehta (mum, 48, HR Manager at an IT firm, Powai; runs the household) ──
function kavita() {
  const t = [
    ['2026-10-02', '10:00', 12000, 'SIP Mirae Asset Large Cap Fund'],
    ['2026-10-03', '10:15', 8000, 'Recurring deposit SBI'],
    ['2026-10-03', '18:30', 3250, 'BigBasket groceries'],
    ['2026-10-04', '08:30', 2500, 'Yoga class monthly fee'],
    ['2026-10-06', '20:00', 649, 'Netflix subscription'],
    ['2026-10-08', '19:00', 710, 'Tata Play DTH recharge'],
    ['2026-10-10', '17:30', 2480, 'Nature\'s Basket fruits and dry fruits'],
    ['2026-10-12', '19:15', 1500, 'Navratri garba passes'],
    ['2026-10-14', '15:20', 6800, 'Chaniya choli shopping for Navratri'],
    ['2026-10-17', '16:00', 3850, 'Lakme salon haircut and facial'],
    ['2026-10-19', '11:00', 1101, 'Siddhivinayak temple donation'],
    ['2026-10-21', '18:00', 1800, 'Dentist appointment Dr Kulkarni'],
    ['2026-10-23', '16:45', 14500, 'Silk saree from Nalli for Diwali'],
    ['2026-10-25', '17:30', 2850, 'Diwali diyas lanterns and fairy lights'],
    ['2026-10-26', '18:10', 6200, 'Diwali gifts for relatives'],
    ['2026-10-28', '12:30', 1450, 'Lunch with colleagues at Smoke House Deli'],
    ['2026-10-31', '10:00', 9000, 'Maid salary October'],
    ['2026-10-31', '10:05', 12000, 'Cook salary October'],
    ['2026-10-31', '17:30', 9850, 'DMart monthly grocery stock'],
    ['2026-10-31', '08:00', 3120, 'Gokul milk monthly bill'],
    ['2026-10-31', '19:30', 380, 'Rangoli colours'],
    // November so far
    ['2026-11-02', '09:45', 12000, 'SIP Mirae Asset Large Cap Fund'],
    ['2026-11-03', '10:10', 8000, 'Recurring deposit SBI'],
    ['2026-11-03', '11:00', 2000, 'Digital gold purchase on PhonePe'],
    ['2026-11-01', '09:00', 820, 'Vegetables from sabzi mandi'],
    ['2026-11-02', '18:40', 560, 'Zepto order milk bread eggs'],
    ['2026-11-03', '08:30', 240, 'Flowers for puja'],
  ];
  for (const d of ALL_DAYS) {
    if (d >= '2026-11-01') continue;
    if (dow(d) === 0 || dow(d) === 3) t.push([d, '09:00', between(550, 950), 'Vegetables from sabzi mandi']);
    if (rand() < 0.3) t.push([d, '18:40', between(280, 900), 'Zepto order milk bread eggs']);
    if (dow(d) === 6 && rand() < 0.6) t.push([d, '17:00', between(350, 650), 'Fruits from local vendor']);
    if (rand() < 0.08) t.push([d, '12:15', between(250, 900), 'Wellness Forever pharmacy']);
  }
  return t;
}

// ── Aarav Mehta (son, 21, final-year B.Tech, pocket money only) ────────────
function aarav() {
  const t = [
    ['2026-10-02', '10:30', 1000, 'SIP Nifty 50 index fund on Groww'],
    ['2026-10-03', '11:00', 650, 'Local train student pass'],
    ['2026-10-05', '09:00', 1500, 'Gym membership monthly'],
    ['2026-10-05', '22:15', 59, 'Spotify premium student'],
    ['2026-10-07', '12:00', 349, 'Jio prepaid recharge'],
    ['2026-10-09', '15:30', 499, 'Udemy machine learning course'],
    ['2026-10-10', '21:45', 720, 'BookMyShow movie tickets'],
    ['2026-10-13', '20:00', 500, 'Garba night entry with friends'],
    ['2026-10-15', '16:20', 1499, 'Myntra hoodie'],
    ['2026-10-18', '23:50', 799, 'Valorant points top-up'],
    ['2026-10-20', '13:00', 280, 'Notebook and stationery'],
    ['2026-10-22', '18:30', 1200, 'Birthday gift for friend'],
    ['2026-10-24', '20:30', 1650, 'Dinner with friends at Social Andheri'],
    ['2026-10-26', '12:30', 300, 'Haircut'],
    ['2026-10-29', '19:00', 899, 'Amazon wireless earbuds sale'],
    // November so far
    ['2026-11-02', '10:20', 1000, 'SIP Nifty 50 index fund on Groww'],
    ['2026-11-01', '23:40', 460, 'Zomato order'],
    ['2026-11-02', '14:10', 280, 'Uber ride to Bandra'],
    ['2026-11-02', '18:45', 640, 'BookMyShow movie tickets'],
    ['2026-11-03', '01:10', 380, 'Swiggy Instamart chips and cold drinks'],
    ['2026-11-03', '11:30', 150, 'Chai and maggi at college canteen'],
    ['2026-11-03', '17:20', 420, 'Starbucks cold coffee'],
  ];
  for (const d of ALL_DAYS) {
    if (d >= '2026-11-01') continue;
    const weekday = [1, 2, 3, 4, 5].includes(dow(d));
    if (weekday && rand() < 0.55) t.push([d, '11:30', between(80, 200), 'Chai and maggi at college canteen']);
    if (weekday && rand() < 0.3) t.push([d, '09:10', between(120, 260), 'Rapido bike taxi to college']);
    if (rand() < 0.22) t.push([d, rand() < 0.4 ? '23:35' : '20:40', between(250, 560), rand() < 0.5 ? 'Swiggy order' : 'Zomato order']);
    if (rand() < 0.12) t.push([d, '17:20', between(320, 480), 'Starbucks cold coffee']);
    if (!weekday && rand() < 0.4) t.push([d, '19:30', between(180, 420), 'Uber ride to Bandra']);
  }
  return t;
}

const PEOPLE = [
  {
    key: 'rajesh', name: 'Rajesh Mehta', email: 'rajesh.mehta@example.com',
    profile: { dateOfBirth: '1974-06-12', retirementAge: 60, monthlyIncome: 240000, currentBalance: 6200000, incomeType: 'salaried' },
    goals: [
      { name: 'Retirement corpus', emoji: '🏖️', targetAmount: 15000000, targetDate: '2034-06-12', monthlyContribution: 50000 },
      { name: 'Aarav\'s Masters abroad', emoji: '🎓', targetAmount: 4000000, targetDate: '2028-08-01', monthlyContribution: 40000 },
    ],
    income: [['2026-10-01', 240000, 'salary', 'October salary - Sun Pharma'], ['2026-11-01', 240000, 'salary', 'November salary - Sun Pharma']],
    tx: rajesh,
  },
  {
    key: 'kavita', name: 'Kavita Mehta', email: 'kavita.mehta@example.com',
    profile: { dateOfBirth: '1978-03-22', retirementAge: 58, monthlyIncome: 130000, currentBalance: 3900000, incomeType: 'salaried' },
    goals: [
      { name: 'Retirement fund', emoji: '🌴', targetAmount: 7500000, targetDate: '2036-03-22', monthlyContribution: 20000 },
      { name: 'Family Kerala trip', emoji: '✈️', targetAmount: 250000, targetDate: '2027-05-01', monthlyContribution: 15000 },
    ],
    income: [['2026-10-01', 130000, 'salary', 'October salary - Infosys Powai'], ['2026-11-01', 130000, 'salary', 'November salary - Infosys Powai']],
    tx: kavita,
  },
  {
    key: 'aarav', name: 'Aarav Mehta', email: 'aarav.mehta@example.com',
    profile: { dateOfBirth: '2005-08-14', retirementAge: 60, monthlyIncome: 18000, currentBalance: 42000, incomeType: 'student' },
    goals: [
      { name: 'MacBook Air', emoji: '💻', targetAmount: 115000, targetDate: '2027-06-01', monthlyContribution: 3000 },
    ],
    income: [['2026-10-01', 18000, 'pocket money', 'Pocket money from Papa'], ['2026-11-01', 18000, 'pocket money', 'Pocket money from Papa']],
    tx: aarav,
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
    Family.deleteMany({ 'members.userId': { $in: ids } }),
    FamilyInvitation.deleteMany({ $or: [{ inviterUserId: { $in: ids } }, { inviteeUserId: { $in: ids } }] }),
    RefreshToken.deleteMany({ userId: { $in: ids } }),
    EmailVerificationToken.deleteMany({ userId: { $in: ids } }),
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
    for (const g of p.goals) { await call('POST', '/api/goals', p.token, g); await tick(); }
    for (const [date, amount, source, description] of p.income) {
      await call('POST', '/api/income', p.token, { amount, source, description, timestamp: at(date, '09:00') });
      await tick();
    }
    const txs = p.tx().sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
    for (const [date, time, amount, description] of txs) {
      // No category sent: the live classifier labels every entry, as on the mobile app
      await call('POST', '/api/transactions', p.token, { amount, description, timestamp: at(date, time), paymentMethodId: 'cash' });
      await tick();
    }
    console.log(`${p.name}: ${txs.length} transactions, ${p.income.length} incomes, ${p.goals.length} goals`);
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
