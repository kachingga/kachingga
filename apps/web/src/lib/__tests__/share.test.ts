import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyText, joinLink, shareInviteCode } from '@/lib/share';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function mockClipboard(writeText = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

afterEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
});

describe('copyText', () => {
  it('copies and confirms with a toast', async () => {
    const writeText = mockClipboard();
    await copyText('alias.mp', 'Alias copiado');
    expect(writeText).toHaveBeenCalledWith('alias.mp');
    expect(toast.success).toHaveBeenCalledWith('Alias copiado');
  });

  it('says so when copying fails', async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    await copyText('x');
    expect(toast.error).toHaveBeenCalledWith('No se pudo copiar');
  });
});

describe('shareInviteCode', () => {
  it('opens the share sheet with a link that fills in the code', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    await shareInviteCode('Viaje', 'AB3X7K2M');
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        url: joinLink('AB3X7K2M'),
        text: expect.stringContaining('AB3X7K2M'),
      }),
    );
    expect(joinLink('AB3X7K2M')).toMatch(/\/grupos\/unirme\?codigo=AB3X7K2M$/);
  });

  it('copies the code when the browser cannot share', async () => {
    const writeText = mockClipboard();
    await shareInviteCode('Viaje', 'AB3X7K2M');
    expect(writeText).toHaveBeenCalledWith('AB3X7K2M');
    expect(toast.success).toHaveBeenCalledWith('Código copiado');
  });

  it('does nothing when the share sheet is closed', async () => {
    const writeText = mockClipboard();
    const abort = Object.assign(new Error('cancel'), { name: 'AbortError' });
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(abort),
      configurable: true,
    });
    await shareInviteCode('Viaje', 'AB3X7K2M');
    expect(writeText).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
