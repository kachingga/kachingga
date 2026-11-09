import { toast } from 'sonner';

/** Copies text and confirms it with a toast (on the phone there's no other sign it worked). */
export async function copyText(text: string, what = 'Copiado') {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(what);
  } catch {
    toast.error('No se pudo copiar');
  }
}

/** Link that opens "Unirme" with the code already filled in. */
export function joinLink(inviteCode: string) {
  return `${window.location.origin}/grupos/unirme?codigo=${encodeURIComponent(inviteCode)}`;
}

/**
 * Shares the invite code with the phone's share sheet (WhatsApp, etc.). Without `navigator.share`
 * (most desktop browsers) it copies the code instead.
 */
export async function shareInviteCode(groupName: string, inviteCode: string) {
  if (typeof navigator.share !== 'function') return copyText(inviteCode, 'Código copiado');
  try {
    await navigator.share({
      title: `Sumate a ${groupName} en Kachingga`,
      text: `Sumate a "${groupName}" en Kachingga con el código ${inviteCode}`,
      url: joinLink(inviteCode),
    });
  } catch (err) {
    // Closing the share sheet is not an error.
    if (err instanceof Error && err.name === 'AbortError') return;
    await copyText(inviteCode, 'Código copiado');
  }
}
