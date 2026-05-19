import { Request, Response, NextFunction } from "express";
import { prisma } from "../index.js";
import { forbidden, notFound } from "../utils/errors.js";

export function requireGlobalAdmin(
  _req: Request,
  _res: Response,
  next: NextFunction
) {
  if (_req.user?.role !== "ADMIN") {
    throw forbidden("Global Admin access required");
  }
  next();
}

export function requireProjectAdmin(projectIdField = "id") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const projectId = req.params[projectIdField];
    const userId = req.user!.userId;

    if (req.user!.role === "ADMIN") {
      return next();
    }

    const membership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
    });

    if (!membership || membership.role !== "ADMIN") {
      throw forbidden("Project Admin access required");
    }

    next();
  };
}

export function requireProjectMember(projectIdField = "id") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const projectId = req.params[projectIdField];
    const userId = req.user!.userId;

    if (req.user!.role === "ADMIN") {
      return next();
    }

    const membership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
    });

    if (!membership) {
      throw notFound("Project not found");
    }

    next();
  };
}
