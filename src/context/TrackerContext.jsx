import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { todayISO } from '../lib/dates';

const TrackerContext = createContext(null);

export function TrackerProvider({ children }) {
  const [supplements, setSupplements] = useState([]);
  const [intakes, setIntakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async (signal) => {
    try {
      const [items, logs] = await Promise.all([
        api('/supplements', { signal }),
        api('/intakes', { signal }),
      ]);
      setSupplements(items.supplements);
      setIntakes(logs.intakes);
      setError('');
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const createSupplement = async (body) => {
    const { supplement } = await api('/supplements', { method: 'POST', body });
    setSupplements((current) => [...current, supplement]);
    return supplement;
  };
  const updateSupplement = async (id, body) => {
    const { supplement } = await api(`/supplements/${id}`, { method: 'PATCH', body });
    setSupplements((current) => current.map((item) => (item.id === id ? supplement : item)));
    return supplement;
  };
  const deleteSupplement = async (id) => {
    await api(`/supplements/${id}`, { method: 'DELETE' });
    setSupplements((current) => current.filter((item) => item.id !== id));
  };
  const markIntake = async (supplementId, date = todayISO()) => {
    const item = supplements.find((entry) => entry.id === supplementId);
    const { intake } = await api('/intakes', {
      method: 'POST',
      body: { supplementId, date, time: item?.time },
    });
    setIntakes((current) =>
      current.some((entry) => entry.id === intake.id) ? current : [...current, intake],
    );
    return intake;
  };
  const unmarkIntake = async (id) => {
    await api(`/intakes/${id}`, { method: 'DELETE' });
    setIntakes((current) => current.filter((item) => item.id !== id));
  };

  return (
    <TrackerContext.Provider
      value={{
        supplements,
        intakes,
        loading,
        error,
        refresh,
        createSupplement,
        updateSupplement,
        deleteSupplement,
        markIntake,
        unmarkIntake,
      }}
    >
      {children}
    </TrackerContext.Provider>
  );
}

export function useTracker() {
  const context = useContext(TrackerContext);
  if (!context) throw new Error('TrackerProvider is required');
  return context;
}
