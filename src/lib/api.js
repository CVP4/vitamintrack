export async function api(path, { body, headers, ...options } = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login')
      window.dispatchEvent(new Event('vitamintrack:session-expired'));
    throw new Error(data.error || 'Не удалось выполнить запрос. Попробуйте ещё раз.');
  }
  return data;
}
