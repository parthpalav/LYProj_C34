const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType,
  HeadingLevel, AlignmentType, ShadingType, BorderStyle, LevelFormat, PageBreak, VerticalAlign,
  TableOfContents, Footer, PageNumber,
} = require('docx');

const BEFORE = path.join(__dirname, '..', 'before');
const AFTER = path.join(__dirname, '..', 'after');
const OUT = path.join(__dirname, '..', 'Finaura-UX-Before-After.docx');

// A4 portrait, 1" margins → 9026 DXA content width
const CONTENT = 9026;
const COL = CONTENT / 2;
const IMG_W = 200; // px; source shots are 368x800
const border = { style: BorderStyle.SINGLE, size: 4, color: 'D0D5DD' };
const borders = { top: border, bottom: border, left: border, right: border };

const p = (text, opts = {}) => new Paragraph({ spacing: { after: 80 }, ...opts, children: [new TextRun({ text, ...(opts.run || {}) })] });
const meta = (label, value) => new Paragraph({
  spacing: { after: 40 }, keepNext: true,
  children: [new TextRun({ text: `${label}: `, bold: true, size: 19 }), new TextRun({ text: value, size: 19 })],
});
const bullet = (text) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 40 }, keepNext: true, children: [new TextRun({ text, size: 20 })] });

function imageCell(dir, file, caption) {
  const full = path.join(dir, file);
  const data = fs.readFileSync(full);
  const w = data.readUInt32BE(16), h = data.readUInt32BE(20);
  return new TableCell({
    borders, width: { size: COL, type: WidthType.DXA }, margins: { top: 120, bottom: 120, left: 120, right: 120 },
    verticalAlign: VerticalAlign.TOP,
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data, transformation: { width: IMG_W, height: Math.round(IMG_W * h / w) } })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: caption, italics: true, size: 17, color: '475467' })] }),
    ],
  });
}
const afterCell = (file, caption) => fs.existsSync(path.join(AFTER, file)) ? imageCell(AFTER, file, caption) : new TableCell({
  borders, width: { size: COL, type: WidthType.DXA }, margins: { top: 120, bottom: 120, left: 120, right: 120 },
  verticalAlign: VerticalAlign.CENTER, shading: { fill: 'F8F9FB', type: ShadingType.CLEAR },
  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'After: to be captured once the overhaul ships', italics: true, size: 18, color: '98A2B3' })] })],
});
const headerCell = (text) => new TableCell({
  borders, width: { size: COL, type: WidthType.DXA }, shading: { fill: 'EEF0FF', type: ShadingType.CLEAR },
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, size: 20, color: '3B3BDE' })] })],
});

function compareTable(shots) {
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA }, columnWidths: [COL, COL],
    rows: [
      new TableRow({ tableHeader: true, children: [headerCell('Before (29 Oct 2026)'), headerCell('After')] }),
      ...shots.map(([file, caption]) => new TableRow({ cantSplit: true, children: [imageCell(BEFORE, file, caption), afterCell(file, caption)] })),
    ],
  });
}

const screens = [
  { group: 'Authentication' },
  { name: 'Login', file: 'client/src/screens/LoginScreen.tsx (inside components/auth/AuthShell.tsx)', reach: 'First screen when signed out (App.tsx gate: no token).',
    what: 'Aurora-gradient background with glass card, Sign in / Create account segmented control, email + password fields, "Forgot?" link.',
    issues: ['The most polished screen in the app; its visual language is not carried into the signed-in app.', 'No biometric sign-in or remember-me.'],
    shots: [['01.png', 'Login, empty form']] },
  { name: 'Create account (Register)', file: 'client/src/screens/RegisterScreen.tsx', reach: 'Login → "Create account" segment (local state, not a route).',
    what: 'Full name, email, password with strength meter, confirm password.',
    issues: ['Copy typo: "in under minute".', 'No terms/privacy consent; income type not collected though the store supports it.'],
    shots: [['60-register.png', 'Register form']] },
  { name: 'Forgot password', file: 'client/src/screens/ForgotPasswordScreen.tsx', reach: 'Login → "Forgot?".',
    what: 'Email field, "Send reset link", "I already have a reset token", back to sign in.',
    issues: ['No deep links, so the user must paste a 64-character token by hand on the Reset screen.'],
    shots: [['61-forgot.png', 'Forgot password']] },
  { name: 'Welcome', file: 'client/src/screens/WelcomeScreen.tsx', reach: 'Shown after an explicit login of an onboarded user.',
    what: 'Logo, "Welcome, {first name}", Continue button.',
    issues: ['Hard cut from the dark aurora login to a stark white page; no shared transition.', 'Uses legacy RN Animated, not Reanimated.'],
    shots: [['03.png', 'Welcome after login']] },

  { group: 'Main tabs' },
  { name: 'Home (Dashboard)', file: 'client/src/screens/DashboardScreen.tsx', reach: 'Home tab (centre, default).',
    what: 'Greeting + theme toggle + avatar; Financial Health (FMI) card; Current Balance hero; Savings Goals piggy bank; Future Outlook (Monte Carlo); Spending Snapshot (Needs/Wants/Invest); Assets, Income Receipts, Upcoming Liabilities; Smart Next Action card at the very bottom.',
    issues: ['About 10 stacked cards with equal weight; the most actionable card (Smart Next Action) is last.', 'Content scrolls under the status bar with no blur or scrim (text collides with the clock).', 'Upcoming Liabilities shows "2 active" next to "No recurring liabilities … scheduled".', 'Retirement insight title truncates; "1/100" funded-chance gauge has no framing.', 'No quick-add for a transaction; data does not refresh when returning from other screens.'],
    shots: [['10-dash.png', 'Dashboard, top'], ['11-dash.png', 'Dashboard, scrolled: Future Outlook, Spending Snapshot'], ['12-dash.png', 'Dashboard, bottom: Assets, Income, Liabilities, Smart Action']] },
  { name: 'Transactions', file: 'client/src/screens/TransactionsScreen.tsx', reach: 'Transactions tab.',
    what: 'Month summary (spent / invested), All/Needs/Wants/Investments chips, Filter button, month-grouped list with emoji icons, type and tag badges, overflow "…" per row, floating + button.',
    issues: ['Default small centred tab header, unlike the large left-aligned headers elsewhere.', 'No search, date range, swipe actions or undo on delete.', '"Needs review" transactions are not flagged in the list.'],
    shots: [['20-Transactions.png', 'Transactions list']] },
  { name: 'Add transaction (Entry sheet)', file: 'client/src/screens/TransactionEntryScreen.tsx (modal from Transactions)', reach: 'Transactions → + button.',
    what: 'Amount, description (AI classifies after typing), category picker, Need/Want/Investment radio, optional liability link, Log Transaction, today / 7-day / wants-ratio footer.',
    issues: ['Backdrop is a solid navy band rather than a dimmed view of the previous screen.', 'Title just says "Entry"; no date picker; numbers in footer are unformatted (₹4529).', 'No keyboard avoidance; drag handle is decorative only (no swipe to dismiss).'],
    shots: [['40-entry.png', 'Entry sheet, empty']] },
  { name: 'Transaction options sheet', file: 'TransactionsScreen.tsx (action sheet)', reach: 'Transactions → "…" on a row, or long-press.',
    what: 'Edit Transaction / Delete Transaction / Cancel.',
    issues: ['Delete goes through a system Alert with no undo.'],
    shots: [['41-txn-options.png', 'Row options sheet']] },
  { name: 'Filter transactions sheet', file: 'TransactionsScreen.tsx (category filter sheet)', reach: 'Transactions → Filter.',
    what: 'Category chips with emoji; Apply Filters.',
    issues: ['"Apply Filters" does nothing extra; filters already apply live.', 'Sheet stays light-themed while the page is dimmed.'],
    shots: [['42-filters.png', 'Category filter sheet']] },
  { name: 'Liabilities', file: 'client/src/screens/LiabilitiesScreen.tsx', reach: 'Liabilities tab.',
    what: 'Active liabilities and monthly commitment totals, next auto-deduct, monthly commitments by category, liability cards with payment history / edit / delete.',
    issues: ['Monthly Commitments card is clipped.', 'Start date and schedule fields are raw text; no pull-to-refresh.'],
    shots: [['20-Liabilities.png', 'Liabilities']] },
  { name: 'AI assistant (Chat)', file: 'client/src/screens/ChatScreen.tsx', reach: 'AI tab.',
    what: 'Intro card, chat bubbles, suggested-question pills, input bar.',
    issues: ['Avatar is the literal text "Bot".', 'Replies are plain text (no markdown, no rich cards, no charts).', 'No retry on failure, no new chat, no copy.'],
    shots: [['20-Chat.png', 'AI chat, first message']] },
  { name: 'Profile', file: 'client/src/screens/ProfileScreen.tsx', reach: 'Profile tab.',
    what: 'Avatar + name, Edit Assumptions, income / retirement-age pills, lettered sections A–D (personal, baselines, retirement assumptions, navigation rows), Sign Out.',
    issues: ['Reads like a form/document; no Settings section (notifications, biometrics, theme, export, delete account).', 'Sign Out has no confirmation.', '"Onboarding Complete" badge is always shown.'],
    shots: [['20-Profile.png', 'Profile']] },
  { name: 'Edit Planning Assumptions sheet', file: 'ProfileScreen.tsx (modal)', reach: 'Profile → Edit Assumptions.',
    what: 'Name, date of birth, declared income, retirement age, corpus goal, return rate, etc.; Save Assumptions.',
    issues: ['Validation errors appear as one system Alert at a time.', 'Date picker is fixed to the light theme.'],
    shots: [['44-edit-assumptions.png', 'Edit Planning Assumptions']] },
  { name: 'Adjust Bank Balance', file: 'client/src/screens/UpdateBalanceScreen.tsx (modal)', reach: 'Home → Current Balance → Update.',
    what: 'Current balance, Credit/Debit, amount, new balance preview, Add Money.',
    issues: ['Shows ₹295302.00 instead of the ₹2,95,302 format used elsewhere.', 'No warning when a debit makes the balance negative.'],
    shots: [['43-update-balance.png', 'Adjust Bank Balance']] },

  { group: 'Pushed screens' },
  { name: 'Financial Health (FMI)', file: 'client/src/screens/FmiScreen.tsx', reach: 'Home → Financial Health card.',
    what: 'Gauge with score and status, 3 pillar cards (Saving Discipline, Spending Control, Behavioral Risk), spending pace, retirement goal progress, insights, actionable alerts, 7-day history.',
    issues: ['Same metric is named "Financial Health", "Financial Mood Index", and elsewhere "Financial Maturity Index".', 'History bars have no dates; alert cards use light-only colours.'],
    shots: [['30-FMI.png', 'FMI, top'], ['31-FMI.png', 'FMI, scrolled']] },
  { name: 'Financial Outlook', file: 'client/src/screens/FinancialOutlookScreen.tsx', reach: 'Home → Future Outlook card.',
    what: 'Ten sections: headline metrics, FIRE projection, Monte Carlo outcomes, guidance, strategy selector, scenarios, income resilience, emergency buffer, assumptions, limitations.',
    issues: ['Very long single scroll with heavy jargon and no section navigation.', 'Changing strategy gives no inline loading feedback.'],
    shots: [['30-FinancialOutlook.png', 'Outlook, top'], ['31-FinancialOutlook.png', 'Outlook, scrolled: simulated outcomes']] },
  { name: 'Savings Goals', file: 'client/src/screens/GoalPlannerScreen.tsx', reach: 'Home → Savings Goals card, or Profile row.',
    what: 'Goal chips on the left, detail card on the right (piggy bank, target, date, saved, "Is this achievable?"), Add money, stats card.',
    issues: ['Two-column layout breaks on a phone: stats wrap mid-number ("₹20,8 / 33", "Increas / e").', 'Delete only by long-press; no edit or withdraw.', '"Achievable" verdict uses a fixed 12-month placeholder.'],
    shots: [['30-Goals.png', 'Savings Goals']] },
  { name: 'Income Streams', file: 'client/src/screens/IncomeFlowScreen.tsx', reach: 'Home → Income Receipts, or Profile row.',
    what: 'Total monthly income and daily pace, 50/30/20 donut, income by source, timeline.',
    issues: ['Donut proportions are fixed at 50/30/20 and do not reflect data.', 'Three different add buttons; date entry is free text.'],
    shots: [['30-IncomeFlow.png', 'Income Streams, top'], ['31-IncomeFlow.png', 'Income Streams, scrolled']] },
  { name: 'Financial Assets', file: 'client/src/screens/AssetsScreen.tsx', reach: 'Home → Assets, or Profile row.',
    what: 'Total assets, FIRE corpus, liquid buffer, holdings with class / FIRE / liquidity badges, edit and delete.',
    issues: ['Always dark navy, even in light mode; uses a different icon set.', 'Badges can contradict ("Retirement / Investable" + "Excluded from FIRE").'],
    shots: [['30-Assets.png', 'Financial Assets']] },
  { name: 'Family & Household', file: 'client/src/screens/FamilyScreen.tsx', reach: 'Profile → Family row (no Home entry for users without a family).',
    what: 'Privacy banner and empty state with "Add Family Member". With a family: roster, household FMI, summary, outflows, insights.',
    issues: ['Not discoverable from Home for new users; pending invites have no badge anywhere else.'],
    shots: [['30-Family.png', 'Family, no household yet']] },

  { group: 'Dark mode' },
  { name: 'Dark mode samples', file: 'theme.ts darkColors', reach: 'Home → moon toggle.',
    what: 'The same screens in dark mode.',
    issues: ['Mostly consistent; red-on-dark text on Goals is hard to read.', 'Status bar collision on scroll is the same as in light mode.'],
    shots: [['50-dark-dash.png', 'Home, dark'], ['53-dark-dash2.png', 'Home scrolled, dark'], ['51-dark-Transactions.png', 'Transactions, dark'], ['51-dark-Chat.png', 'AI chat, dark'], ['52-dark-FMI.png', 'FMI, dark'], ['52-dark-Goals.png', 'Savings Goals, dark'], ['52-dark-IncomeFlow.png', 'Income Streams, dark']] },
];

const children = [
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('FINAURA mobile app: UX before / after')] }),
  p('Reference screenshots of every reachable screen before the UX overhaul. Each screen has a description, the issues seen, and an empty "After" column to fill in once the overhaul ships.'),
  meta('Captured', '29 Oct 2026, main @ 1ef5142e'),
  meta('Device', 'iPhone 17 Pro simulator, iOS 26.0, Expo dev client'),
  meta('Account', 'claude.uitest@example.com (sample data); light mode unless marked dark'),
  meta('Not captured', 'Onboarding (needs a new account), Reset Password, and Alerts / Envelopes / Reports (these exist in code but no route reaches them)'),
  meta('Note', 'The "Open debugger to view warnings" bar in some shots is a development-only overlay, not part of the app.'),
  new Paragraph({ spacing: { before: 200 }, children: [] }),
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: 'Screens in this document', bold: true })] }),
  ...screens.map((s) => s.group ? new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: s.group, bold: true, color: '3B3BDE' })] }) : bullet(s.name)),
];

for (const s of screens) {
  if (s.group) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(s.group)] }));
    continue;
  }
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280 }, keepNext: true, children: [new TextRun(s.name)] }));
  children.push(meta('File', s.file));
  children.push(meta('How to reach', s.reach));
  children.push(meta('What it shows', s.what));
  children.push(new Paragraph({ spacing: { before: 80, after: 40 }, keepNext: true, children: [new TextRun({ text: 'Issues seen', bold: true, size: 19 })] }));
  s.issues.forEach((i) => children.push(bullet(i)));
  children.push(new Paragraph({ spacing: { after: 80 }, keepNext: true, children: [] }));
  children.push(compareTable(s.shots));
}

const doc = new Document({
  creator: 'Parth Palav',
  title: 'FINAURA UX before / after',
  styles: {
    default: { document: { run: { font: 'Arial', size: 21 } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { size: 40, bold: true, color: '0F172A' }, paragraph: { spacing: { after: 160 } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, color: '3B3BDE' }, paragraph: { spacing: { before: 120, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: '0F172A' }, paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{
    properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '98A2B3' })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log(OUT); });
