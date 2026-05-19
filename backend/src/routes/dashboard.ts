import { Router, Request, Response } from "express";
import { prisma } from "../index.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/summary", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === "ADMIN";

  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  let projectIds: string[] = [];

  if (!isAdmin) {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    projectIds = memberships.map((m) => m.projectId);
  }

  const taskWhere = isAdmin ? {} : { projectId: { in: projectIds } };
  const projectWhere = isAdmin ? {} : { id: { in: projectIds } };

  const [totalTasks, completedThisWeek, overdueTasks, activeProjects] =
    await Promise.all([
      prisma.task.count({ where: taskWhere }),
      prisma.task.count({
        where: {
          ...taskWhere,
          status: "DONE",
          updatedAt: { gte: startOfWeek },
        },
      }),
      prisma.task.count({
        where: {
          ...taskWhere,
          status: { not: "DONE" },
          dueDate: { lt: new Date() },
        },
      }),
      prisma.project.count({
        where: { ...projectWhere, status: "ACTIVE" },
      }),
    ]);

  res.json({
    totalTasks,
    completedThisWeek,
    overdueTasks,
    activeProjects,
  });
});

router.get("/my-tasks", async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const tasks = await prisma.task.findMany({
    where: { assigneeId: userId },
    include: {
      project: { select: { id: true, title: true } },
    },
    orderBy: [
      { status: "asc" },
      { dueDate: "asc" },
    ],
  });

  res.json({ tasks });
});

router.get("/overdue", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === "ADMIN";

  let projectIds: string[] = [];

  if (!isAdmin) {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    projectIds = memberships.map((m) => m.projectId);
  }

  const taskWhere = isAdmin ? {} : { projectId: { in: projectIds } };

  const tasks = await prisma.task.findMany({
    where: {
      ...taskWhere,
      status: { not: "DONE" },
      dueDate: { lt: new Date() },
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, title: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const overdue = tasks.map((t) => ({
    ...t,
    daysOverdue: Math.floor(
      (Date.now() - new Date(t.dueDate!).getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));

  res.json({ tasks: overdue });
});

export default router;
