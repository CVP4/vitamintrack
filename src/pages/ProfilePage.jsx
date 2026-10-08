import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTracker } from '../context/TrackerContext';
import { PageHeading } from '../components/UI';

export function ProfilePage() {
  const { user, updateProfile, logout } = useAuth();
  const { supplements, intakes } = useTracker();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
  }, [user?.name]);

  async function save(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Введите ваше имя.');
      return;
    }
    setError('');
    setSaved(false);
    setBusy(true);
    try {
      await updateProfile({ name: name.trim() });
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Не удалось обновить профиль.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Не удалось выйти. Попробуйте ещё раз.');
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Ваше пространство"
        title="Мой профиль"
        description="Настройте, как VitaminTrack обращается к вам, и управляйте своей учётной записью."
      />
      <div className="profile-grid">
        <section className="panel profile-summary">
          <div className="profile-avatar">{(user?.name?.trim()[0] || 'V').toUpperCase()}</div>
          <h2>{user?.name || 'Пользователь'}</h2>
          <p className="muted">
            {user?.isDemo ? 'Пример профиля для знакомства с трекером' : user?.email}
          </p>
          <span className="tag tag-success">
            <ShieldCheck size={15} /> {user?.isDemo ? 'Демопрофиль' : 'Личный аккаунт'}
          </span>
          <div className="profile-stats">
            <div>
              <strong>{supplements.length}</strong>
              <span className="muted">добавок</span>
            </div>
            <div>
              <strong>{intakes.length}</strong>
              <span className="muted">отметок</span>
            </div>
          </div>
        </section>
        <section className="panel profile-form">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Давайте познакомимся</span>
              <h2>Личные данные</h2>
            </div>
            <UserRound size={21} />
          </div>
          <form onSubmit={save}>
            <label className="form-field">
              <span>Ваше имя</span>
              <input
                className="input"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSaved(false);
                  setError('');
                }}
                required
                maxLength={60}
                autoComplete="name"
                placeholder="Как к вам обращаться?"
              />
            </label>
            {!user?.isDemo && (
              <label className="form-field">
                <span>
                  <Mail size={15} /> Электронная почта
                </span>
                <input className="input" type="email" value={user?.email || ''} readOnly />
                <small className="muted">Email используется для входа в аккаунт.</small>
              </label>
            )}
            {error && (
              <div className="callout callout-error" role="alert">
                {error}
              </div>
            )}
            {saved && (
              <div className="callout callout-success" role="status">
                <Check size={17} /> Профиль обновлён
              </div>
            )}
            <div className="form-actions">
              <button
                className="button button-primary"
                type="submit"
                disabled={busy || name.trim() === user?.name}
              >
                {busy ? 'Сохраняем…' : 'Сохранить изменения'}
              </button>
            </div>
          </form>
        </section>
      </div>
      <section className="panel account-panel">
        <div>
          <h2>Учётная запись</h2>
          <p className="muted">
            {user?.isDemo
              ? 'Демопрофиль доступен до выхода или истечения сессии. Новый демовход создаст отдельный пример. Для постоянного плана зарегистрируйтесь.'
              : 'При следующем входе ваш список добавок и история будут на месте.'}
          </p>
        </div>
        <button className="button button-secondary" disabled={busy} onClick={signOut}>
          <LogOut size={17} /> Выйти из аккаунта
        </button>
      </section>
    </>
  );
}

export default ProfilePage;
