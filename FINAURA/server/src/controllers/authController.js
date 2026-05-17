import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'finaura_dev_secret';

function issueToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function stripUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    age: user.age,
    income: user.income,
    incomeType: user.incomeType,
    retirementAge: user.retirementAge,
    retirementCorpusGoal: user.retirementCorpusGoal,
    currentBalance: user.currentBalance,
    fixedObligations: user.fixedObligations,
    onboardingCompleted: user.onboardingCompleted
  };
}

export async function register(req, res) {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ message: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });
  const token = issueToken(user);
  return res.json({ token, user: stripUser(user) });
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const token = issueToken(user);
  return res.json({ token, user: stripUser(user) });
}
