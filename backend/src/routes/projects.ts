import { Router, Request, Response } from "express";
import { prisma } from "../index.js";
import { authenticate } from "../middleware/auth.js";
import { requireProjectAdmin, requireProjectMember } from "../middleware/rbac.js";
import { createProjectSchema, updateProjectSchema } from "../validators/project.js";
import { createTaskSchema } from "../validators/task.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";

const router = Router();

router.use(authenticate);

router.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  if (req.user!.role === "ADMIN") {
    const projects = await prisma.project.findMany({
      include: {
        _count: { select: { members: true, tasks: true } },
        tasks: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ projects });
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });

  const projectIds = memberships.map((m) => m.projectId);

  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    include: {
      _count: { select: { members: true, tasks: true } },
      tasks: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ projects });
});

router.post("/", async (req: Request, res: Response) => {
  const data = createProjectSchema.parse(req.body);
  const userId = req.user!.userId;

  if (data.deadline) {
    const d = new Date(data.deadline);
    if (isNaN(d.getTime()) || d <= new Date()) {
      throw badRequest("Deadline must be a future date", "deadline");
    }
  }

  const existing = await prisma.project.findFirst({
    where: { title: data.title, ownerId: userId },
  });
  if (existing) {
    throw badRequest("You already have a project with this title", "title");
  }

  const project = await prisma.project.create({
    data: {
      title: data.title,
      description: data.description,
      deadline: data.deadline ? new Date(data.deadline) : null,
      ownerId: userId,
    },
  });

  await prisma.projectMember.create({
    data: {
      userId,
      projectId: project.id,
      role: "ADMIN",
    },
  });

  res.status(201).json({ project });
});

router.patch("/:id", requireProjectAdmin(), async (req: Request, res: Response) => {
  const data = updateProjectSchema.parse(req.body);
  const projectId = req.params.id;

  if (data.deadline) {
    const d = new Date(data.deadline);
    if (isNaN(d.getTime()) || d <= new Date()) {
      throw badRequest("Deadline must be a future date", "deadline");
    }
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw notFound("Project not found");

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status && { status: data.status }),
      ...(data.deadline && { deadline: new Date(data.deadline) }),
    },
  });

  res.json({ project: updated });
});

router.delete("/:id", requireProjectAdmin(), async (req: Request, res: Response) => {
  const projectId = req.params.id;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw notFound("Project not found");

  const openTasks = await prisma.task.count({
    where: { projectId, status: { not: "DONE" } },
  });
  if (openTasks > 0) {
    throw badRequest("Cannot delete project with open tasks. Complete or delete all tasks first.");
  }

  await prisma.projectMember.deleteMany({ where: { projectId } });
  await prisma.task.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } });

  res.json({ message: "Project deleted successfully" });
});

router.post("/:id/members", requireProjectAdmin(), async (req: Request, res: Response) => {
  const projectId = req.params.id;
  const { email, role } = req.body;

  if (!email) throw badRequest("Email is required");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw notFound("User not found with this email");

  const existing = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: user.id, projectId } },
  });
  if (existing) {
    throw badRequest("User is already a member of this project");
  }

  const member = await prisma.projectMember.create({
    data: {
      userId: user.id,
      projectId,
      role: role === "ADMIN" ? "ADMIN" : "MEMBER",
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  res.status(201).json({ member });
});

router.delete("/:id/members/:userId", requireProjectAdmin(), async (req: Request, res: Response) => {
  const { id: projectId, userId } = req.params;

  if (req.user!.userId === userId) {
    throw badRequest("Cannot remove yourself from the project");
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw notFound("Project not found");

  if (project.ownerId === userId) {
    throw badRequest("Cannot remove the project owner");
  }

  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!member) throw notFound("Member not found");

  await prisma.projectMember.delete({
    where: { userId_projectId: { userId, projectId } },
  });

  res.json({ message: "Member removed successfully" });
});

router.get("/:id/members", requireProjectMember(), async (req: Request, res: Response) => {
  const projectId = req.params.id;

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  res.json({ members });
});

router.get("/:id/tasks", requireProjectMember(), async (req: Request, res: Response) => {
  const projectId = req.params.id;
  const { priority } = req.query;

  const where: any = { projectId };
  if (priority && ["LOW", "MEDIUM", "HIGH"].includes(priority as string)) {
    where.priority = priority;
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ tasks });
});

router.post("/:id/tasks", requireProjectMember(), async (req: Request, res: Response) => {
  const projectId = req.params.id;
  const data = createTaskSchema.parse(req.body);

  if (data.dueDate) {
    const d = new Date(data.dueDate);
    if (isNaN(d.getTime()) || d <= new Date()) {
      throw badRequest("Due date must not be in the past", "dueDate");
    }
  }

  if (data.assigneeId) {
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: data.assigneeId, projectId } },
    });
    if (!member) {
      throw badRequest("Assignee must be a project member", "assigneeId");
    }
  }

  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority || "MEDIUM",
      assigneeId: data.assigneeId || null,
      projectId,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  if (task.assigneeId) {
    await prisma.notification.create({
      data: {
        userId: task.assigneeId,
        title: "Task Assigned",
        message: `You have been assigned task "${task.title}"`,
        taskId: task.id,
        projectId,
      },
    });
  }

  await prisma.activityLog.create({
    data: {
      actorId: req.user!.userId,
      action: "CREATED",
      target: "TASK",
      targetId: task.id,
      taskId: task.id,
      projectId,
    },
  });

  res.status(201).json({ task });
});

router.get("/:id/tasks/export", requireProjectMember(), async (req: Request, res: Response) => {
  const projectId = req.params.id;

  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      assignee: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const header = "Title,Status,Priority,Assignee,Assignee Email,Due Date,Created At\n";
  const rows = tasks
    .map(
      (t) =>
        `"${t.title}","${t.status}","${t.priority}","${t.assignee?.name || ""}","${t.assignee?.email || ""}","${t.dueDate?.toISOString() || ""}","${t.createdAt.toISOString()}"`
    )
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=tasks-${projectId}.csv`);
  res.send(header + rows);
});

export default router;
