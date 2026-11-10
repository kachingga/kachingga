import { createContext, useContext, type ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  /** Text, or JSX when it needs more than a sentence (e.g. a list). */
  description?: ReactNode;
  /** Text of the confirm button (default "Confirmar"). */
  confirmLabel?: string;
  /** Red confirm button, for things that delete or can't be undone. */
  destructive?: boolean;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Asks the user to confirm with the app's own dialog (instead of the browser's `confirm()`).
 * `if (await confirm({ title: '¿Borrar este gasto?', destructive: true })) …`
 */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm needs <ConfirmProvider>');
  return confirm;
}
