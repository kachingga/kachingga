import * as Sentry from '@sentry/react';
import { TRPCClientError } from '@trpc/client';

import { OFFLINE_MESSAGE } from '@/lib/offline-cache';

// Error monitoring with Sentry: only the front's own bugs (render errors, exceptions in the app).
// API errors are reported by the API itself (only the unexpected ones), so a tRPC error is never
// reported from here. Without VITE_SENTRY_DSN (local, tests, CI) nothing is initialized.
// Details: docs/claude/repo/monitoreo.md.

let enabled = false;

export function initMonitoring(env: Partial<ImportMetaEnv> = import.meta.env) {
  if (!env.VITE_SENTRY_DSN) return false;
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: env.VITE_SENTRY_ENVIRONMENT,
    release: __APP_RELEASE__ || undefined,
    // Collect nothing about the user or the requests: no IP, cookies, headers (the token), query
    // strings (tRPC GET carries the input, with amounts) or bodies.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSend: scrubEvent,
  });
  enabled = true;
  return true;
}

/** Whether an error is a bug worth reporting: not an API error (tRPC) nor "no connection". */
export function isUnexpected(error: unknown) {
  if (error instanceof TRPCClientError) return false;
  if (error instanceof Error && error.message === OFFLINE_MESSAGE) return false;
  return true;
}

export function reportError(error: unknown) {
  if (!enabled || !isUnexpected(error)) return false;
  Sentry.captureException(error);
  return true;
}

/** Only the Supabase user id: never the email. */
export function setMonitoringUser(userId: string | null) {
  if (enabled) Sentry.setUser(userId ? { id: userId } : null);
}

const withoutQuery = (url: unknown) => (typeof url === 'string' ? url.split('?')[0] : url);

/**
 * Drops console breadcrumbs (they may print data from the screens) and removes the query from
 * fetch and navigation URLs (tRPC inputs carry amounts; filters may be in the URL).
 */
export function scrubBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  if (breadcrumb.category === 'console') return null;
  if (breadcrumb.data) {
    for (const key of ['url', 'from', 'to'] as const) {
      if (key in breadcrumb.data) breadcrumb.data[key] = withoutQuery(breadcrumb.data[key]);
    }
  }
  return breadcrumb;
}

export function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request) {
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.query_string;
    delete event.request.data;
    if (event.request.url) event.request.url = event.request.url.split('?')[0];
  }
  if (event.user) event.user = { id: event.user.id };
  return event;
}
