import { useState } from 'react';
import { Check, ExternalLink, Plus } from 'lucide-react';
import { categoryLabels } from '../lib/supplements';
import { formatDate } from '../lib/dates';

export function BottleArt({ color = 'sage' }) {
  const labels = {
    sage: '#d6e3c9',
    apricot: '#f2d4b2',
    lavender: '#ded6e9',
    blue: '#c9dde5',
  };
  return (
    <svg className="catalog-bottle-art" viewBox="0 0 240 200" fill="none" aria-hidden="true">
      <ellipse cx="120" cy="183" rx="61" ry="9" fill="#243D2B" opacity=".08" />
      <path
        d="M86 47h68v14c0 5 5 9 10 12 8 6 13 15 13 26v63c0 10-8 18-18 18H81c-10 0-18-8-18-18V99c0-11 5-20 13-26 5-3 10-7 10-12V47Z"
        fill="#FCFBF5"
        stroke="#D5D6CB"
        strokeWidth="1.5"
      />
      <path
        d="M72 100h96v61c0 5-4 9-9 9H81c-5 0-9-4-9-9v-61Z"
        fill={labels[color] || labels.sage}
      />
      <path d="M63 95h114v12H63V95Z" fill={labels[color] || labels.sage} />
      <rect x="79" y="22" width="82" height="29" rx="6" fill="#2F4D39" />
      {[88, 100, 112, 124, 136, 148].map((x) => (
        <path key={x} d={`M${x} 28v17`} stroke="#4D6854" strokeWidth="2" />
      ))}
      <path d="M85 81c-7 3-11 10-11 18" stroke="#FFF" strokeWidth="5" strokeLinecap="round" />
      <circle cx="120" cy="127" r="17" fill="#FCFBF5" opacity=".85" />
      <path
        d="M113 129c0-8 4-12 15-12 0 10-4 14-12 14m-4 5 13-15"
        stroke="#456046"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M101 152h38m-30 7h22"
        stroke="#456046"
        opacity=".5"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect
        x="181"
        y="151"
        width="35"
        height="15"
        rx="7.5"
        transform="rotate(-35 181 151)"
        fill={labels[color] || labels.sage}
        stroke="#FCFBF5"
        strokeWidth="2"
      />
      <path d="m195 144 8 12" stroke="#FCFBF5" strokeWidth="2" />
    </svg>
  );
}

export function ProductArt({ product }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`catalog-card-art color-${product.color || 'sage'}`}>
      {product.imageUrl && !failed ? (
        <div className="catalog-product-image">
          <img
            src={product.imageUrl}
            alt={`Состав ${product.name}`}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        </div>
      ) : (
        <BottleArt color={product.color} />
      )}
    </div>
  );
}

export function CatalogCard({ product, inPlan, onImport }) {
  return (
    <article className={`catalog-card panel color-${product.color || 'sage'}`}>
      <ProductArt product={product} />
      <div className="catalog-card-body">
        <span className="catalog-card-category eyebrow">
          {categoryLabels[product.category] || 'Добавка'}
        </span>
        <h2 className="catalog-card-title">{product.name}</h2>
        <p className="catalog-card-brand muted">{product.brand || 'Бренд не указан'}</p>
        <div className="catalog-card-meta">
          <span>{product.form || 'Форма не указана'}</span>
          <span>NIH DSLD</span>
        </div>
        <p className="catalog-card-record muted">
          Запись #{product.id}
          {product.labelDate && (
            <span>
              {' · '}В базе с{' '}
              {formatDate(product.labelDate, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </p>
        <div className="catalog-card-actions">
          <button
            type="button"
            className="button button-primary"
            disabled={inPlan}
            onClick={() => onImport(product)}
            aria-label={
              inPlan ? `${product.name} уже в моём плане` : `Добавить ${product.name} в мой план`
            }
          >
            {inPlan ? <Check size={16} /> : <Plus size={16} />}
            {inPlan ? 'В моём плане' : 'Добавить'}
          </button>
          <a
            className="button button-ghost"
            href={product.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Состав ${product.name}`}
          >
            Состав <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </article>
  );
}
