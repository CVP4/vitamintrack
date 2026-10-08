import { Link } from 'react-router-dom';
import { Check, Clock3 } from 'lucide-react';
import { PillIcon } from './UI';

export function IntakeRow({ supplement, taken, disabled, pending, onToggle }) {
  return (
    <div className={`intake-row ${taken ? 'is-taken' : ''}`}>
      <PillIcon color={supplement.color} />
      <div className="intake-name">
        <Link to={`/supplements/${supplement.id}`}>{supplement.name}</Link>
        <span>
          {supplement.dose}
          {supplement.brand ? ` · ${supplement.brand}` : ''}
        </span>
      </div>
      <span className="intake-time">
        <Clock3 size={13} />
        {supplement.time}
      </span>
      <button
        className={`intake-button ${taken ? 'taken' : ''}`}
        onClick={() => onToggle(supplement)}
        disabled={disabled}
        aria-label={`${taken ? 'Отменить приём' : 'Отметить приём'}: ${supplement.name}`}
      >
        <Check size={16} />
        <span>{pending ? '…' : taken ? 'Принято' : 'Принять'}</span>
      </button>
    </div>
  );
}
