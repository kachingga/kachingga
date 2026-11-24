import { useState } from 'react';
import { isSingleEmoji } from '@kachingga/api/schemas';

import { Chip, Field } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// The usual ones, to pick with a tap. Any other: typed with the phone's emoji keyboard.
const SUGGESTED = [
  '✈️',
  '🏖️',
  '🏔️',
  '🏠',
  '🍖',
  '🍕',
  '🍻',
  '🎉',
  '🎂',
  '⚽',
  '🚗',
  '🛒',
  '💼',
  '🎓',
  '❤️',
  '🐶',
];

/**
 * Choose the group's emoji (it shows instead of its initial): one of the usual ones or any other,
 * or back to the initial. Validated like the API (`isSingleEmoji`).
 */
export function GroupEmojiPicker({
  current,
  saving,
  onPick,
  onCancel,
}: {
  current: string | null;
  saving: boolean;
  onPick: (emoji: string | null) => void;
  onCancel: () => void;
}) {
  const [other, setOther] = useState('');
  const [error, setError] = useState<string | null>(null);

  function pickOther(e: React.FormEvent) {
    e.preventDefault();
    const emoji = other.trim();
    if (!isSingleEmoji(emoji)) return setError('Escribí un solo emoji.');
    setError(null);
    onPick(emoji);
  }

  return (
    <div className="space-y-4" aria-busy={saving || undefined}>
      <div role="group" aria-label="Emojis" className="flex flex-wrap gap-2">
        {SUGGESTED.map((emoji) => (
          <Chip
            key={emoji}
            active={emoji === current}
            aria-label={`Elegir ${emoji}`}
            disabled={saving}
            onClick={() => onPick(emoji)}
            className="text-xl"
          >
            {emoji}
          </Chip>
        ))}
      </div>
      <form onSubmit={pickOther} noValidate className="flex items-end gap-2">
        <Field label="Otro" htmlFor="other-emoji" className="flex-1">
          <Input
            id="other-emoji"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="Ej.: 🦩"
            autoComplete="off"
          />
        </Field>
        <Button type="submit" variant="outline" disabled={saving}>
          Usar
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {current && (
          <Button variant="outline" size="sm" disabled={saving} onClick={() => onPick(null)}>
            Quitar el emoji
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
