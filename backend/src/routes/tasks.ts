import { Router, Request, Response } from "express";
import { prisma } from "../index.js";
import { authenticate } from "../middleware/auth.js";
import { updateTaskSchema, updateTaskStatusSchema } from "../validators/task.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";

const router = Router();

router.use(authenticate);

const STATUS_ORDER: Record<string, number> = {
  TODO: 0,
  IN_PROGRESS: 1,
  DONE: 2,
};

router.patch("/:id", async (req: Request, res: Response) => {
  const taskId = req.params.id;
  const data = updateTaskSchema.parse(req.body);
  const userId = req.user!.userId;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) throw notFound("Task not found");

  const isAdmin = req.user!.role === "ADMIN";
  const isCreator = task.project.ownerId === userId;

  let isProjectAdmin = false;
  if (!isAdmin && !isCreator) {
    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: task.projectId } },
    });
    isProjectAdmin = membership?.role === "ADMIN";
  }

  if (!isAdmin && !isCreator && !isProjectAdmin) {
    throw forbidden("Only Admin or task creator can edit tasks");
  }

  if (data.dueDate) {
    const d = new Date(data.dueDate);
    if (isNaN(d.getTime()) || d <= new Date()) {
      throw badRequest("Due date must not be in the past", "dueDate");
    }
  }

  if (data.assigneeId) {
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: data.assigneeId, projectId: task.projectId } },
    });
    if (!member) {
      throw badRequest("Assignee must be a project member", "assigneeId");
    }
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.priority && { priority: data.priority }),
      ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  if (updated.assigneeId && updated.assigneeId !== task.assigneeId) {
    await prisma.notification.create({
      data: {
        userId: updated.assigneeId,
        title: "Task Assigned",
        message: `You have been assigned task "${updated.title}"`,
        taskId: updated.id,
        projectId: updated.projectId,
      },
    });
  }

  await prisma.activityLog.create({
    data: {
      actorId: userId,
      action: "UPDATED",
      target: "TASK",
      targetId: task.id,
      taskId: task.id,
      projectId: task.projectId,
    },
  });

  res.json({ task: updated });
});

router.patch("/:id/status", async (req: Request, res: Response) => {
  const taskId = req.params.id;
  const { status } = updateTaskStatusSchema.parse(req.body);
  const userId = req.user!.userId;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) throw notFound("Task not found");

  const isAdmin = req.user!.role === "ADMIN" || task.project.ownerId === userId;
  const isAssignee = task.assigneeId === userId;

  let isProjectAdmin = false;
  if (!isAdmin && !isAssignee) {
    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: task.projectId } },
    });
    isProjectAdmin = membership?.role === "ADMIN";
  }

  if (!isAdmin && !isAssignee && !isProjectAdmin) {
    throw forbidden("Only assignee or admin can update task status");
  }

  const currentOrder = STATUS_ORDER[task.status];
  const newOrder = STATUS_ORDER[status];

  if (newOrder < currentOrder) {
    throw badRequest("Status can only move forward (TODO -> IN_PROGRESS -> DONE)");
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  await prisma.activityLog.create({
    data: {
      actorId: userId,
      action: `STATUS_CHANGED_TO_${status}`,
      target: "TASK",
      targetId: task.id,
      taskId: task.id,
      projectId: task.projectId,
    },
  });

  res.json({ task: updated });
});

router.delete("/:id", async (req: Request, res: Response) => {
  const taskId = req.params.id;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) throw notFound("Task not found");

  const userId = req.user!.userId;
  const isGlobalAdmin = req.user!.role === "ADMIN";

  let isProjectAdmin = false;
  if (!isGlobalAdmin) {
    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: task.projectId } },
    });
    isProjectAdmin = membership?.role === "ADMIN";
  }

  if (!isGlobalAdmin && !isProjectAdmin) {
    throw forbidden("Only Project Admin or Global Admin can delete tasks");
  }

  await prisma.notification.deleteMany({ where: { taskId } });
  await prisma.activityLog.deleteMany({ where: { taskId } });
  await prisma.task.delete({ where: { id: taskId } });

  res.json({ message: "Task deleted successfully" });
});

export default router;
