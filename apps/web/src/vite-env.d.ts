/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** Sentry (optional): without it, error monitoring is off. Public by design. */
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  /** Cloudflare Turnstile (optional): without it, no captcha on login / register. Public by design. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

/** Commit being built (Railway's RAILWAY_GIT_COMMIT_SHA), or '' locally. Set in vite.config.ts. */
declare const __APP_RELEASE__: string;
