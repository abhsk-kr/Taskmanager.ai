import { Router, Request, Response } from "express";
import { prisma } from "../index.js";
import { authenticate } from "../middleware/auth.js";
import { requireGlobalAdmin } from "../middleware/rbac.js";

const router = Router();

router.use(authenticate);

router.get("/", requireGlobalAdmin, async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ users });
});

export default router;
