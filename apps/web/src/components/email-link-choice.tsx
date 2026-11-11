import { AuthLayout } from '@/components/auth-layout';
import { Button } from '@/components/ui/button';

/**
 * A mail's link opened with a session already open (`useEmailLinkResult`, src/lib/email-link.ts):
 * the person picks whether to use it or stay in the account they're in.
 */
export function EmailLinkChoice({
  email,
  onContinue,
  onStay,
}: {
  email: string | undefined;
  onContinue: () => void;
  onStay: () => void;
}) {
  return (
    <AuthLayout title="¿Seguís con este link?" subtitle="Es de un mail de Kachingga.">
      <p className="mb-6">
        Ya tenés la sesión abierta como <strong className="break-all">{email}</strong>. Si no
        pediste este mail, quedate en tu cuenta; si lo pediste vos, seguí con el link.
      </p>
      <div className="space-y-2">
        <Button size="lg" className="w-full" onClick={onStay}>
          Quedarme en mi cuenta
        </Button>
        <Button variant="outline" size="lg" className="w-full" onClick={onContinue}>
          Seguir con el link
        </Button>
      </div>
    </AuthLayout>
  );
}
