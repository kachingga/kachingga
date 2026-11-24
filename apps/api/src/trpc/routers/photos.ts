import { z } from 'zod'
import { prisma } from '../../db'
import { requireActiveGroup } from '../../lib/access'
import { deletePhoto, MAX_PHOTO_BYTES, photosEnabled, photoUrl, storePhoto } from '../../lib/photos'
import { id } from '../../schemas'
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
    const key = await storePhoto(input.photo)
    const before = await prisma.userProfile.findUnique({ where: { userId: ctx.user.id }, select: { photoKey: true } })
    await prisma.userProfile.upsert({
      where: { userId: ctx.user.id },
      create: { userId: ctx.user.id, photoKey: key },
      update: { photoKey: key },
    })
    await deletePhoto(before?.photoKey)
    return { photoUrl: photoUrl(key) }
  }),

  removeMine: protectedProcedure.mutation(async ({ ctx }) => {
    const before = await prisma.userProfile.findUnique({ where: { userId: ctx.user.id }, select: { photoKey: true } })
    if (before?.photoKey) {
      await prisma.userProfile.update({ where: { userId: ctx.user.id }, data: { photoKey: null } })
      await deletePhoto(before.photoKey)
    }
    return { photoUrl: null }
  }),

  // The group's photo: any member (no admins), like its name or emoji. Read-only when archived.
  setGroup: protectedProcedure.input(z.object({ groupId: id, photo })).mutation(async ({ ctx, input }) => {
    const { group } = await requireActiveGroup(input.groupId, ctx.user.id)
    const key = await storePhoto(input.photo)
    await prisma.group.update({ where: { id: group.id }, data: { photoKey: key } })
    await deletePhoto(group.photoKey)
    return { photoUrl: photoUrl(key) }
  }),

  removeGroup: protectedProcedure.input(z.object({ groupId: id })).mutation(async ({ ctx, input }) => {
    const { group } = await requireActiveGroup(input.groupId, ctx.user.id)
    if (group.photoKey) {
      await prisma.group.update({ where: { id: group.id }, data: { photoKey: null } })
      await deletePhoto(group.photoKey)
    }
    return { photoUrl: null }
  }),
})
