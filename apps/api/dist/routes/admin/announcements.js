import { adminAnnouncementsContract } from '@repo/types';
import { implement } from '@orpc/server';
import { prisma } from '@repo/db';
import { handlePrismaError } from '../../utils/errors';
export const announcementsRouter = implement(adminAnnouncementsContract).router({
    list: implement(adminAnnouncementsContract.list).handler(async () => {
        try {
            const announcements = await prisma.announcement.findMany({
                orderBy: { createdAt: 'desc' },
                include: { admin: { select: { fullName: true } } }
            });
            return { announcements: announcements };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    create: implement(adminAnnouncementsContract.create).handler(async ({ input, context }) => {
        try {
            const admin = context.user;
            const announcement = await prisma.announcement.create({
                data: {
                    title: input.title,
                    body: input.body,
                    type: input.type,
                    isActive: input.isActive,
                    targetAll: input.targetAll,
                    expiresAt: input.expiresAt,
                    createdBy: admin.id
                }
            });
            return { announcement: announcement };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    update: implement(adminAnnouncementsContract.update).handler(async ({ input }) => {
        try {
            const announcement = await prisma.announcement.update({
                where: { id: input.id },
                data: input.data
            });
            return { announcement: announcement };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    delete: implement(adminAnnouncementsContract.delete).handler(async ({ input }) => {
        try {
            await prisma.announcement.delete({ where: { id: input.id } });
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    })
});
