import { adminAnnouncementsContract } from '@repo/types';
import { implement } from '@orpc/server';
import { prisma } from '@repo/db';
import { AppError } from '../../utils/errors';
import { AuditService } from '../../lib/auditService';
export const announcementsRouter = implement(adminAnnouncementsContract).router({
    list: implement(adminAnnouncementsContract.list).handler(async () => {
        const announcements = await prisma.announcement.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return { announcements: announcements };
    }),
    create: implement(adminAnnouncementsContract.create).handler(async ({ input, context }) => {
        const admin = context.user;
        const announcement = await prisma.announcement.create({
            data: {
                ...input,
                createdBy: admin.id
            }
        });
        await AuditService.log({
            adminId: admin.id,
            action: 'CREATE_ANNOUNCEMENT',
            entity: 'announcement',
            entityId: announcement.id,
            after: announcement
        });
        return { announcement: announcement };
    }),
    update: implement(adminAnnouncementsContract.update).handler(async ({ input, context }) => {
        const admin = context.user;
        const oldAnnouncement = await prisma.announcement.findUnique({ where: { id: input.id } });
        if (!oldAnnouncement)
            throw new AppError('Announcement not found', 'NOT_FOUND', 404);
        const announcement = await prisma.announcement.update({
            where: { id: input.id },
            data: input.data
        });
        await AuditService.log({
            adminId: admin.id,
            action: 'UPDATE_ANNOUNCEMENT',
            entity: 'announcement',
            entityId: announcement.id,
            before: oldAnnouncement,
            after: announcement
        });
        return { announcement: announcement };
    }),
    delete: implement(adminAnnouncementsContract.delete).handler(async ({ input, context }) => {
        const admin = context.user;
        await prisma.announcement.delete({
            where: { id: input.id }
        });
        await AuditService.log({
            adminId: admin.id,
            action: 'DELETE_ANNOUNCEMENT',
            entity: 'announcement',
            entityId: input.id
        });
        return { success: true };
    })
});
