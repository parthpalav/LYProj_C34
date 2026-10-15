import type { ReactNode } from 'react';
import { ArrowUpRight, CircleHelp } from 'lucide-react';
import { Link } from 'react-router-dom';

interface NextStepProps {
  title: string;
  description: string;
  action: string;
  to: string;
  eyebrow?: string;
  icon?: ReactNode;
}

/** One consistent first-use action across financial workspaces. */
export function NextStep({ title, description, action, to, eyebrow = 'NEXT STEP', icon }: NextStepProps) {
  return (
    <section className="next-step">
      <div className="next-step-icon" aria-hidden="true">{icon ?? <CircleHelp size={24} />}</div>
      <div className="next-step-copy">
        <span className="next-step-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <Link className="next-step-action" to={to}>{action}<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </section>
  );
}
