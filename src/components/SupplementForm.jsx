import { useState } from 'react';
import { Info } from 'lucide-react';
import { categoryLabels } from '../lib/supplements';

const categoryColors = { vitamin: 'sage', mineral: 'apricot', omega: 'blue', other: 'lavender' };

export function SupplementForm({ initialValues = {}, onSubmit, onCancel }) {
  const [values, setValues] = useState({
    name: initialValues.name || '',
    brand: initialValues.brand || '',
    category: initialValues.category || 'vitamin',
    dose: initialValues.dose || '',
    time: initialValues.time || '09:00',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const change = (event) =>
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit(
        initialValues.id
          ? values
          : {
              ...values,
              color: initialValues.color || categoryColors[values.category],
              notes: initialValues.notes || '',
            },
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="supplement-form">
      <div className="form-row">
        <label className="form-field">
          Название
          <input
            className="input"
            name="name"
            value={values.name}
            onChange={change}
            placeholder="Например, витамин D3"
            maxLength={100}
            required
          />
        </label>
        <label className="form-field">
          Бренд <span className="optional">необязательно</span>
          <input
            className="input"
            name="brand"
            value={values.brand}
            onChange={change}
            placeholder="Производитель"
            maxLength={100}
          />
        </label>
      </div>
      <div className="form-row">
        <label className="form-field">
          Категория
          <select className="select" name="category" value={values.category} onChange={change}>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          Дозировка
          <input
            className="input"
            name="dose"
            value={values.dose}
            onChange={change}
            placeholder="Из вашего назначения"
            maxLength={100}
            required
          />
        </label>
      </div>
      <div className="form-row">
        <label className="form-field">
          Время ежедневного приёма
          <input
            className="input"
            type="time"
            name="time"
            value={values.time}
            onChange={change}
            required
          />
        </label>
      </div>
      <p className="form-note">
        <Info size={16} />
        Укажите дозировку из вашего назначения. Трекер помогает вести учёт.
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Отмена
        </button>
        <button className="button button-primary" type="submit" disabled={saving}>
          {saving ? 'Сохраняем…' : initialValues.id ? 'Сохранить изменения' : 'Добавить в мой план'}
        </button>
      </div>
    </form>
  );
}
