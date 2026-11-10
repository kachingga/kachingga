import { useEffect, useState, type ReactNode } from 'react';
import { MailCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { resendConfirmation } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';
import { useCaptcha } from '@/lib/use-captcha';

// Supabase lets each address ask for a mail once a minute.
const RESEND_COOLDOWN_SECONDS = 60;

/** "We sent you a mail": the notice of the login screens that send one. */
export function MailSent({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-accent p-4 text-sm text-accent-foreground">
      <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

/**
 * Confirm the email, with "Reenviar mail": after registering (when Supabase asks to confirm it) and
 * on the login when it isn't confirmed yet. The mail's link comes back to `returnTo`. `justSent`:
 * the mail just went out, so resending waits a minute. `children` goes at the bottom (how to go on).
 */
export function ConfirmEmailSent({
  email,
  returnTo,
  justSent = false,
  children,
}: {
  email: string;
  returnTo: string;
  justSent?: boolean;
  children: ReactNode;
}) {
  const captcha = useCaptcha();
  const [cooldown, setCooldown] = useState(justSent ? RESEND_COOLDOWN_SECONDS : 0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Counts down the seconds until another mail can be asked for.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    setError(null);
    setSending(true);
    const { error: authError } = await resendConfirmation(email, {
      returnTo,
      captchaToken: captcha.token,
    });
    setSending(false);
    captcha.reset();
    if (authError) return setError(authErrorMessage(authError));
    toast.success(`Te mandamos otro mail a ${email}`);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <div className="space-y-4">
      <MailSent>
        Te mandamos un mail a <strong className="break-all">{email}</strong> con un link para
        confirmar tu cuenta. Tocalo y listo.
      </MailSent>
      <p className="text-sm text-muted-foreground">¿No te llegó? Fijate en spam o pedí otro.</p>
      {captcha.widget}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={handleResend}
        loading={sending}
        disabled={captcha.waiting || cooldown > 0}
      >
        {sending
          ? 'Reenviando…'
          : cooldown > 0
            ? `Reenviar mail (en ${cooldown} s)`
            : 'Reenviar mail'}
      </Button>
      {children}
    </div>
  );
}
