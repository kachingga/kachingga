import * as Sentry from '@sentry/bun'
import { TRPCError } from '@trpc/server'

// Error monitoring with Sentry: only unexpected errors (bugs, the DB down). Business errors
// (NOT_FOUND, BAD_REQUEST, UNAUTHORIZED…) are part of normal use and are never reported.
// Without SENTRY_DSN (local, tests, CI) nothing is initialized. Details: docs/claude/repo/monitoreo.md.

let enabled = false

export function initMonitoring(env: Record<string, string | undefined> = process.env) {
  if (!env.SENTRY_DSN) return false
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    release: env.RAILWAY_GIT_COMMIT_SHA,
    tracesSampleRate: 0,
    // Collect nothing about the user or the request: no IP, cookies, headers (the token), query
    // (tRPC GET carries the input there) or bodies (amounts, aliases). scrubEvent double-checks.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    beforeSend: scrubEvent,
  })
  enabled = true
  return true
}

/**
 * Never send what a request carries: the token (headers), amounts and aliases (body, and the
 * tRPC `?input=` of GET requests), cookies or the IP.
 */
export function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request) {
    delete event.request.data
    delete event.request.headers
    delete event.request.cookies
    delete event.request.query_string
    if (event.request.url) event.request.url = event.request.url.split('?')[0]
  }
  if (event.user) event.user = { id: event.user.id }
  return event
}

/** tRPC `onError`: reports only INTERNAL_SERVER_ERROR (what isn't a business error). */
export function reportTrpcError({ error, path }: { error: TRPCError; path?: string }) {
  if (error.code !== 'INTERNAL_SERVER_ERROR') return false
  return reportError(error.cause ?? error, { procedure: path })
}

export function reportError(error: unknown, tags?: Record<string, string | undefined>) {
  if (!enabled) return false
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(tags ?? {})) if (value) scope.setTag(key, value)
    Sentry.captureException(error)
  })
  return true
}
