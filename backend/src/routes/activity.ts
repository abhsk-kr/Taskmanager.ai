import { Router, Request, Response } from "express";
import { prisma } from "../index.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", async (req: Request, res: Response) => {
  const { projectId } = req.query;

  const where: any = {};
  if (projectId) where.projectId = projectId;

  const logs = await prisma.activityLog.findMany({
    where,
    include: {
      actor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json({ logs });
});

export default router;
