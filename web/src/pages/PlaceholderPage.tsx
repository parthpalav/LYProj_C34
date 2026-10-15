import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { ArrowUpRight, CheckCircle2, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export interface PlannedSectionItem { name: string; description: string; link?: string; }
export interface PlaceholderPageProps {
  title: string;
  category?: string;
  description: string;
  plannedFeatures?: PlannedSectionItem[];
  partNotice?: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, plannedFeatures = [] }) => {
  const { user } = useAuth();
  const isSettings = title === 'Settings';
  const baseline = user?.monthlyIncome ?? user?.income;
  const details = isSettings ? [
    ['Session', 'Signed in on this browser'],
    ['Account email', user?.email ?? 'Not available'],
    ['Email verification', user?.isEmailVerified === undefined ? 'Not available' : user.isEmailVerified ? 'Verified' : 'Not verified'],
  ] : [
    ['Full name', user?.name ?? 'Not set'],
    ['Email address', user?.email ?? 'Not set'],
    ['Monthly income baseline', baseline == null ? 'Not set' : `₹${baseline.toLocaleString('en-IN')}`],
    ['Retirement age', user?.retirementAge == null ? 'Not set' : `${user.retirementAge} years`],
  ];
  return (
    <div className="account-page">
      <PageHeader title={isSettings ? 'Settings' : 'Your profile'} category="YOUR ACCOUNT" description={isSettings ? 'Your current session and account status.' : 'Your personal details and saved financial baseline.'} />
      <section className="account-summary">
        <div className="account-summary-heading"><UserRound size={22} aria-hidden="true" /><h2>{isSettings ? 'Session and security' : 'Account details'}</h2><span><CheckCircle2 size={14} aria-hidden="true" /> Signed in</span></div>
        <dl>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <p className="account-view-note">{isSettings ? 'Use Logout in the navigation to end this browser session.' : 'These details are read-only on the web. Use the mobile app to update your financial profile.'}</p>
      </section>
      <div className="account-available"><div><span className="next-step-eyebrow">AVAILABLE NOW</span><h2>{isSettings ? 'Keep a copy of your records' : 'Manage your household'}</h2><p>{isSettings ? 'Download your financial records from Reports.' : 'View members and invitations while keeping personal accounts private.'}</p></div><Link className="next-step-action" to={isSettings ? '/app/reports?tab=export' : '/app/family'}>{isSettings ? 'Open exports' : 'Open Family'}<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      <details className="account-planned"><summary>Planned web features</summary><ul>{plannedFeatures.filter((item) => !item.link).map((item) => <li key={item.name}><strong>{item.name}</strong><p>{item.description}</p></li>)}</ul></details>
    </div>
  );
};
