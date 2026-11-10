import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Password field with a button to show what was typed. The button goes next to the field, not inside
 * it: password managers (1Password, Bitwarden…) put their own icon at the field's right edge and
 * would cover it.
 */
export function PasswordInput(props: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex gap-2">
      <Input {...props} type={visible ? 'text' : 'password'} />
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="shrink-0"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        aria-controls={props.id}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </Button>
    </div>
  );
}
