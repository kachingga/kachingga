import { TRPCClientError } from '@trpc/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  initMonitoring,
  isUnexpected,
  reportError,
  scrubBreadcrumb,
  scrubEvent,
} from '@/lib/monitoring';
import { OFFLINE_MESSAGE } from '@/lib/offline-cache';

const sentry = vi.hoisted(() => ({ init: vi.fn(), captureException: vi.fn(), setUser: vi.fn() }));
vi.mock('@sentry/react', () => sentry);

describe('monitoring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing without VITE_SENTRY_DSN', () => {
    expect(initMonitoring({})).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
    expect(reportError(new Error('bug'))).toBe(false);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('reports bugs, never API errors or "no connection"', () => {
    expect(initMonitoring({ VITE_SENTRY_DSN: 'https://k@sentry.example/1' })).toBe(true);

    const apiError = new TRPCClientError('No encontrado');
    expect(isUnexpected(apiError)).toBe(false);
    expect(reportError(apiError)).toBe(false);
    expect(reportError(new Error(OFFLINE_MESSAGE))).toBe(false);
    expect(sentry.captureException).not.toHaveBeenCalled();

    const bug = new TypeError("Cannot read properties of undefined (reading 'name')");
    expect(reportError(bug)).toBe(true);
    expect(sentry.captureException).toHaveBeenCalledWith(bug);
  });

  it('removes queries from breadcrumbs and drops console ones', () => {
    expect(
      scrubBreadcrumb({
        category: 'fetch',
        data: {
          url: 'https://api.kachingga.com/trpc/expenses.summary?input=%7B%7D',
          method: 'GET',
        },
      }),
    ).toEqual({
      category: 'fetch',
      data: { url: 'https://api.kachingga.com/trpc/expenses.summary', method: 'GET' },
    });
    expect(
      scrubBreadcrumb({ category: 'navigation', data: { from: '/a?x=1', to: '/b?y=2' } }),
    ).toEqual({ category: 'navigation', data: { from: '/a', to: '/b' } });
    expect(
      scrubBreadcrumb({ category: 'navigation', data: { from: '/a#x', to: '/b?y=2#z' } }),
    ).toEqual({ category: 'navigation', data: { from: '/a', to: '/b' } });
    expect(scrubBreadcrumb({ category: 'console', message: 'monto 1000' })).toBeNull();
  });

  it('keeps only the user id and the URL without query or hash', () => {
    const event = scrubEvent({
      type: undefined,
      request: { url: 'https://kachingga.com/grupos/1?q=1#total', headers: { a: 'b' } },
      user: { id: 'user-1', email: 'galo@example.com' },
    });
    expect(event.request).toEqual({ url: 'https://kachingga.com/grupos/1' });
    expect(event.user).toEqual({ id: 'user-1' });

    expect(scrubEvent({ type: undefined, request: { url: 'https://kachingga.com/a#b' } })).toEqual({
      type: undefined,
      request: { url: 'https://kachingga.com/a' },
    });
  });
});
