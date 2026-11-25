import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '../../db'
import { requireActiveGroup } from '../../lib/access'
import { deletePhoto, MAX_PHOTO_BYTES, photosEnabled, photoUrl, storePhoto } from '../../lib/photos'
import { id } from '../../schemas'

/**
 * Points the row from the photo it had (`before`) to `next`, only if it still has `before`: two
 * changes at the same time can't both win and leave a photo behind in the storage. The one that
 * loses deletes what it just uploaded and says so; the winner deletes the old one.
 */
async function replacePhoto(before: string | null, next: string | null, update: () => Promise<{ count: number }>) {
  const { count } = await update()
  if (count === 0) {
    await deletePhoto(next)
    throw new TRPCError({ code: 'CONFLICT', message: 'La foto cambió mientras tanto. Probá de nuevo.' })
  }
  await deletePhoto(before)
}
import { protectedProcedure, router } from '../init'

// A JPEG as base64 (src/lib/photo.ts in the web makes it): its size is checked again once decoded.
const photo = z
  .string()
  .max(Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 4)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Esa imagen no se puede usar: probá con otra foto.')

// Profile and group photos (root CLAUDE.md → "Fotos"). Whoever has the link sees the photo while
// it lasts (lib/photos.ts); the links only go to the members of the groups where it shows.
export const photosRouter = router({
  // Whether photos can be added (off without R2: the web hides the buttons).
  config: protectedProcedure.query(() => ({ enabled: photosEnabled() })),

  // My photo, in all my groups. Only mine: nobody sets someone else's, nor one for someone without account.
  setMine: protectedProcedure.input(z.object({ photo })).mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id
    await prisma.userProfile.upsert({ where: { userId }, create: { userId }, update: {} })
    const before = (await prisma.userProfile.findUniqueOrThrow({ where: { userId }, select: { photoKey: true } })).photoKey
    const key = await storePhoto(input.photo)
    await replacePhoto(before, key, () => prisma.userProfile.updateMany({ where: { userId, photoKey: before }, data: { photoKey: key } }))
    return { photoUrl: photoUrl(key) }
  }),

  removeMine: protectedProcedure.mutation(async ({ ctx }) => {
    const before = (await prisma.userProfile.findUnique({ where: { userId: ctx.user.id }, select: { photoKey: true } }))?.photoKey
    if (before) {
      await replacePhoto(before, null, () =>
        prisma.userProfile.updateMany({ where: { userId: ctx.user.id, photoKey: before }, data: { photoKey: null } }),
      )
    }
    return { photoUrl: null }
  }),

  // The group's photo: any member (no admins), like its name or emoji. Read-only when archived.
  setGroup: protectedProcedure.input(z.object({ groupId: id, photo })).mutation(async ({ ctx, input }) => {
    const { group } = await requireActiveGroup(input.groupId, ctx.user.id)
    const key = await storePhoto(input.photo)
    await replacePhoto(group.photoKey, key, () =>
      prisma.group.updateMany({ where: { id: group.id, photoKey: group.photoKey }, data: { photoKey: key } }),
    )
    return { photoUrl: photoUrl(key) }
  }),

  removeGroup: protectedProcedure.input(z.object({ groupId: id })).mutation(async ({ ctx, input }) => {
    const { group } = await requireActiveGroup(input.groupId, ctx.user.id)
    if (group.photoKey) {
      await replacePhoto(group.photoKey, null, () =>
        prisma.group.updateMany({ where: { id: group.id, photoKey: group.photoKey }, data: { photoKey: null } }),
      )
    }
    return { photoUrl: null }
  }),
})
