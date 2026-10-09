'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { AuthState } from '../types';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    username: null,
    loading: true,
  });

  const checkAuth = useCallback(async () => {
    try {
      const status = await api.getTokenStatus();
      // If we can fetch token status, we're authenticated
      setAuthState({
        isAuthenticated: true,
        username: localStorage.getItem('username'),
        loading: false,
      });
    } catch {
      setAuthState({
        isAuthenticated: false,
        username: null,
        loading: false,
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (username: string, password: string) => {
    await api.login(username, password);
    localStorage.setItem('username', username);
    setAuthState({ isAuthenticated: true, username, loading: false });
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    localStorage.removeItem('username');
    setAuthState({ isAuthenticated: false, username: null, loading: false });
  }, []);

  return {
    ...authState,
    login,
    logout,
    checkAuth,
  };
}