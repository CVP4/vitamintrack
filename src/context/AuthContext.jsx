import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const expireSession = () => setUser(null);
    window.addEventListener('vitamintrack:session-expired', expireSession);
    api('/auth/me', { signal: controller.signal })
      .then(({ user: current }) => {
        setUser(current);
        setError('');
      })
      .catch((err) => {
        if (err.name !== 'AbortError')
          setError('Сервер недоступен. Убедитесь, что приложение запущено через npm run dev.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      window.removeEventListener('vitamintrack:session-expired', expireSession);
    };
  }, []);

  const authenticate = async (path, body) => {
    const { user: current } = await api(path, { method: 'POST', body });
    setUser(current);
    setError('');
    return current;
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const updateProfile = async (body) => {
    const { user: current } = await api('/auth/profile', { method: 'PATCH', body });
    setUser(current);
    return current;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login: (body) => authenticate('/auth/login', body),
        register: (body) => authenticate('/auth/register', body),
        loginDemo: () => authenticate('/auth/demo'),
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required');
  return context;
}
