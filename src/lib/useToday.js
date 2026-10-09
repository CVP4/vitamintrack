import { useSyncExternalStore } from 'react';
import { millisecondsUntilNextDay, todayISO } from './dates';

function subscribeToday(onChange) {
  let timer;
  const update = () => {
    clearTimeout(timer);
    onChange();
    timer = setTimeout(update, millisecondsUntilNextDay() + 25);
  };
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') update();
  };
  window.addEventListener('focus', update);
  document.addEventListener('visibilitychange', handleVisibility);
  update();
  return () => {
    clearTimeout(timer);
    window.removeEventListener('focus', update);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

export function useToday() {
  return useSyncExternalStore(subscribeToday, todayISO);
}
