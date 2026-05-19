import { z } from "zod";

export const createProjectSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(80, "Title must be at most 80 characters"),
  description: z.string().max(500).optional(),
  deadline: z.string().optional().nullable(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(3).max(80).optional(),
  description: z.string().max(500).optional(),
  status: z.string().optional(),
  deadline: z.string().optional().nullable(),
});
