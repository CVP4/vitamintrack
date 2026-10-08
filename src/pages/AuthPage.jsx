import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Pill, ArrowRight, Check, Eye, EyeOff, Leaf, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AuthPage({ mode = 'login' }) {
  const { user, login, register, loginDemo, error: connectionError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const signingUp = mode === 'register';
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');
  if (user) return <Navigate to="/" replace />;
  const change = (event) =>
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  const enter = async (event) => {
    event.preventDefault();
    setPending('form');
    setError('');
    try {
      await (signingUp ? register(values) : login(values));
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(err.message);
      setPending('');
    }
  };
  const demo = async () => {
    setPending('demo');
    setError('');
    try {
      await loginDemo();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setPending('');
    }
  };
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Link to="/login" className="brand">
          <span className="brand-icon">
            <Pill size={23} />
          </span>
          Vitamin<span>Track</span>
        </Link>
        <div className="auth-story-content">
          <span className="auth-chip">
            <Leaf size={15} /> ПЕРСОНАЛЬНЫЙ ТРЕКЕР ДОБАВОК
          </span>
          <h1>
            Ваш маленький
            <br />
            ежедневный
            <br />
            <em>ритуал заботы.</em>
          </h1>
          <p>
            Соберите свой план, отмечайте приёмы
            <br />и наблюдайте за привычкой — день за днём.
          </p>
          <div className="auth-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="floating-pill floating-pill-one">
              <span />
            </div>
            <div className="floating-pill floating-pill-two">
              <span />
            </div>
            <span className="art-leaf">
              <Leaf size={68} strokeWidth={1} />
            </span>
            <div className="art-check">
              <Check size={19} />
              Ещё один шаг для себя
            </div>
            <span className="art-spark">✧</span>
          </div>
        </div>
        <p className="auth-story-footer">В вашем темпе. В вашем ритме.</p>
      </section>
      <section className="auth-main">
        <div className="auth-form-wrapper">
          <span className="auth-welcome">
            <Sparkles size={18} /> НАЧНЁМ С ХОРОШЕЙ ПРИВЫЧКИ
          </span>
          <h2>{signingUp ? 'Добро пожаловать' : 'С возвращением'}</h2>
          <p className="auth-subtitle">
            {signingUp
              ? 'Создайте профиль и соберите свой первый план.'
              : 'Ваш план заботы о себе уже ждёт вас.'}
          </p>
          <div className="auth-tabs">
            <Link to="/login" className={!signingUp ? 'selected' : ''}>
              Вход
            </Link>
            <Link to="/register" className={signingUp ? 'selected' : ''}>
              Регистрация
            </Link>
          </div>
          <form onSubmit={enter}>
            {signingUp && (
              <label className="form-field">
                Как вас зовут?
                <input
                  className="input"
                  name="name"
                  autoComplete="given-name"
                  placeholder="Ваше имя"
                  value={values.name}
                  onChange={change}
                  minLength={2}
                  maxLength={60}
                  required
                />
              </label>
            )}
            <label className="form-field">
              Электронная почта
              <input
                className="input"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={values.email}
                onChange={change}
                required
                maxLength={254}
              />
            </label>
            <label className="form-field">
              Пароль
              <div className="password-field">
                <input
                  className="input"
                  name="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete={signingUp ? 'new-password' : 'current-password'}
                  placeholder={signingUp ? 'Не менее 8 символов' : 'Ваш пароль'}
                  value={values.password}
                  onChange={change}
                  minLength={signingUp ? 8 : 1}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {(error || connectionError) && (
              <p className="error-message" role="alert">
                {error || connectionError}
              </p>
            )}
            <button className="button button-primary auth-submit" disabled={Boolean(pending)}>
              {pending === 'form' ? 'Подождите…' : signingUp ? 'Создать профиль' : 'Войти в трекер'}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="auth-or">
            <span />
            или познакомьтесь с приложением
            <span />
          </div>
          <button
            className="button button-secondary demo-button"
            onClick={demo}
            disabled={Boolean(pending)}
          >
            {pending === 'demo' ? 'Готовим ваш трекер…' : 'Попробовать демоверсию'}
            <ArrowRight size={17} />
          </button>
          <p className="demo-description">
            Отдельный профиль с примерами.
            <br />
            Можно менять данные и пробовать все функции.
          </p>
        </div>
        <p className="auth-privacy">
          <span className="privacy-dot" />
          Ваши записи доступны только в вашем профиле.
        </p>
      </section>
    </div>
  );
}
