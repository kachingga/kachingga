import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProfilePhotoCard } from '@/components/profile-photo-card';
import { renderWithApi } from '@/test/render';

vi.mock('@/lib/auth', () => ({ useSession: () => ({ user: { id: 'u1', email: 'yo@mail.com' } }) }));
// jsdom has no canvas: what the browser would upload
vi.mock('@/lib/photo', async (original) => ({
  ...(await original<typeof import('@/lib/photo')>()),
  photoToJpeg: vi.fn(async () => 'BASE64JPEG'),
}));

const file = () => new File(['x'], 'yo.jpg', { type: 'image/jpeg' });

describe('ProfilePhotoCard (Mi cuenta)', () => {
  it('hidden when the API has photos off', async () => {
    const config = vi.fn(() => ({ enabled: false }));
    renderWithApi(<ProfilePhotoCard />, {
      'photos.config': config,
      'profile.get': () => ({ paymentAlias: null, photoUrl: null }),
    });
    await waitFor(() => expect(config).toHaveBeenCalled());
    expect(screen.queryByText('Tu foto')).not.toBeInTheDocument();
  });

  it('puts my photo (my groups see it) and takes it away', async () => {
    const user = userEvent.setup();
    let photoUrl: string | null = null;
    const setMine = vi.fn(() => ({ photoUrl: (photoUrl = 'https://fotos.test/yo.jpg') }));
    const removeMine = vi.fn(() => ({ photoUrl: (photoUrl = null) }));
    const { container } = renderWithApi(<ProfilePhotoCard />, {
      'photos.config': () => ({ enabled: true }),
      'profile.get': () => ({ paymentAlias: null, photoUrl }),
      'photos.setMine': setMine,
      'photos.removeMine': removeMine,
    });
    expect(await screen.findByText('La ven las personas de tus grupos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Poner una foto' })).toBeInTheDocument();

    await user.upload(screen.getByTestId('photo-input'), file());
    await waitFor(() => expect(setMine).toHaveBeenCalledWith({ photo: 'BASE64JPEG' }));
    await waitFor(() =>
      expect(container.querySelector('img')).toHaveAttribute('src', 'https://fotos.test/yo.jpg'),
    );
    expect(screen.getByRole('button', { name: 'Cambiar la foto' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sacarla' }));
    await waitFor(() => expect(removeMine).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector('img')).toBeNull());
  });

  it('if uploading fails, says why', async () => {
    const user = userEvent.setup();
    renderWithApi(<ProfilePhotoCard />, {
      'photos.config': () => ({ enabled: true }),
      'profile.get': () => ({ paymentAlias: null, photoUrl: null }),
      'photos.setMine': () => {
        throw new Error('Esa imagen no se puede usar: probá con otra foto.');
      },
    });
    await screen.findByText('Tu foto');
    await user.upload(screen.getByTestId('photo-input'), file());
    expect(
      await screen.findByText(/No se subió la foto: .*Esa imagen no se puede usar/),
    ).toBeInTheDocument();
  });
});
