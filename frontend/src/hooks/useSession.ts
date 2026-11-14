'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { api, ApiError } from '../lib/api';

export type SessionStatus = 'checking' | 'authenticated' | 'unauthenticated';

const configuredIdleMinutes = Number(process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES);
const IDLE_MINUTES =
  Number.isFinite(configuredIdleMinutes) && configuredIdleMinutes > 0
    ? configuredIdleMinutes
    : 120;

const IDLE_MS = IDLE_MINUTES * 60_000;
const TICK_MS = 30_000;
const HEARTBEAT_MS = 60_000;
const ACTIVITY_WINDOW_MS = 60_000;
const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'wheel',
] as const;

let authChannel: BroadcastChannel | null = null;

function getAuthChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!authChannel) {
    authChannel = new BroadcastChannel('auth');
  }
  return authChannel;
}

/**
 * Single source of truth for the browser session.
 *
 * The server owns expiry (idle + absolute); this hook mirrors it so the UI
 * redirects proactively instead of rendering a dashboard full of 401s.
 */
export function useSession() {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [username, setUsername] = useState<string | null>(null);
  const [absoluteExpiresAt, setAbsoluteExpiresAt] = useState<number | null>(null);

  const lastActivityRef = useRef(Date.now());
  const lastPingRef = useRef(0);
  const endingRef = useRef(false);

  const logout = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setStatus('unauthenticated');
    setUsername(null);
    try {
      await api.logout();
    } catch {}
    getAuthChannel()?.postMessage('logout');
    router.replace('/login');
  }, [router]);

  const expire = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setStatus('unauthenticated');
    setUsername(null);
    try {
      await api.logout();
    } catch {}
    getAuthChannel()?.postMessage('logout');
    router.replace('/login?expired=1');
  }, [router]);

  // Boot: validate the cookie against the server, never trust local storage.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const info = await api.me();
        if (cancelled) return;
        const now = Date.now();
        lastActivityRef.current = now;
        lastPingRef.current = now;
        setUsername(info.username);
        setAbsoluteExpiresAt(Date.parse(info.session_expires_at));
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        setStatus('unauthenticated');
        router.replace('/login');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Activity tracking (ref updates only — no requests per event).
  useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, onActivity, { passive: true })
    );

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, onActivity)
      );
    };
  }, []);

  // Idle / absolute expiry + heartbeat, evaluated on a timer and immediately
  // when the tab regains focus (covers sleep and background timer throttling).
  useEffect(() => {
    if (status !== 'authenticated') return;

    const check = () => {
      const now = Date.now();

      if (now - lastActivityRef.current >= IDLE_MS) {
        void expire();
        return;
      }
      if (absoluteExpiresAt && now >= absoluteExpiresAt) {
        void expire();
        return;
      }

      const activeRecently = now - lastActivityRef.current < ACTIVITY_WINDOW_MS;
      if (
        document.visibilityState === 'visible' &&
        activeRecently &&
        now - lastPingRef.current >= HEARTBEAT_MS
      ) {
        lastPingRef.current = now;
        api.me().catch((err) => {
          if (err instanceof ApiError && err.status === 401) {
            void expire();
          }
        });
      }
    };

    const intervalId = window.setInterval(check, TICK_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    check();

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [status, absoluteExpiresAt, expire]);

  // Any 401 from a data call, and logout in another tab, end this session too.
  useEffect(() => {
    const onExpired = () => {
      void expire();
    };

    const channel = getAuthChannel();
    const onMessage = (event: MessageEvent) => {
      if (event.data !== 'logout') return;
      setStatus('unauthenticated');
      setUsername(null);
      router.replace('/login');
    };

    window.addEventListener('auth:expired', onExpired);
    channel?.addEventListener('message', onMessage);

    return () => {
      window.removeEventListener('auth:expired', onExpired);
      channel?.removeEventListener('message', onMessage);
    };
  }, [expire, router]);

  return { status, username, logout, expire };
}
