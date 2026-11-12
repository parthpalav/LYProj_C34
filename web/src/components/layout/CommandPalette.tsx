import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { searchDestinations } from '../../utils/destinations';

/** "Jump to anything": a search button in the top bar, also opened with Ctrl/Cmd + K. */
export const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchDestinations(query), [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((was) => !was);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = () => { setOpen(false); setQuery(''); setActive(0); };
  const go = (to: string) => { close(); navigate(to); };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active].to); }
  };

  return (
    <>
      <button type="button" className="palette-trigger" onClick={() => setOpen(true)} aria-label="Search and jump to any page">
        <Search size={15} aria-hidden="true" />
        <span>Jump to…</span>
        <kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} K</kbd>
      </button>

      <Modal isOpen={open} onClose={close} title="Jump to" subtitle="Search any page or action" maxWidth="560px">
        <div className="palette-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `palette-item-${active}` : undefined}
            aria-label="Search pages and actions"
            placeholder="Try “expense”, “FIRE”, “export”…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onInputKey}
          />
        </div>
        <ul id="palette-results" role="listbox" className="palette-results">
          {results.map((d, i) => (
            <li
              key={d.to}
              id={`palette-item-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'palette-item palette-item-active' : 'palette-item'}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(d.to)}
              ref={i === active ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
            >
              <div><strong>{d.label}</strong><span>{d.hint}</span></div>
              {i === active && <CornerDownLeft size={14} aria-hidden="true" />}
            </li>
          ))}
          {results.length === 0 && <li className="palette-empty">Nothing matches “{query}”.</li>}
        </ul>
      </Modal>
    </>
  );
};
