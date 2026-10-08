import { useEffect, useRef } from 'react';
import { X, Sprout } from 'lucide-react';

export function PillIcon({ color = 'sage', size = 'normal' }) {
  return (
    <span className={`pill-art ${color} ${size}`} aria-hidden="true">
      <span className="capsule" />
    </span>
  );
}

export function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="page-kicker">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon = Sprout, title, description, children }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      Загружаем ваш трекер…
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    const getFocusable = () =>
      [...dialog.querySelectorAll('button,input,select,textarea,a[href]')].filter(
        (element) => !element.disabled,
      );
    getFocusable()[0]?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key === 'Tab') {
        const elements = getFocusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={dialogRef}
      >
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Закрыть окно">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
