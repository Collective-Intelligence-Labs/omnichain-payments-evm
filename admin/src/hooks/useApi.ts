import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function useApi() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });
      if (res.status === 401) {
        localStorage.removeItem('oc_admin_token');
        window.location.reload();
        throw new Error('Unauthorized');
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed: ${res.status}`);
      }
      return res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const clearError = useCallback(() => setError(null), []);

  return { request, loading, error, clearError };
}
