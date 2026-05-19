import { PrismaClient } from "@prisma/client";
import { hashPassword } from "./utils/password.js";

const prisma = new PrismaClient();

async function seed() {
  const adminPassword = await hashPassword("Admin1234");
  const memberPassword = await hashPassword("Member1234");

  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@example.com",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  const member = await prisma.user.create({
    data: {
      name: "John Member",
      email: "member@example.com",
      password: memberPassword,
      role: "MEMBER",
    },
  });

  const project = await prisma.project.create({
    data: {
      title: "Sample Project",
      description: "A sample project for testing",
      ownerId: admin.id,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.projectMember.create({
    data: { userId: admin.id, projectId: project.id, role: "ADMIN" },
  });

  await prisma.projectMember.create({
    data: { userId: member.id, projectId: project.id, role: "MEMBER" },
  });

  await prisma.task.createMany({
    data: [
      {
        title: "Design database schema",
        description: "Create the initial database schema design",
        status: "DONE",
        priority: "HIGH",
        assigneeId: admin.id,
        projectId: project.id,
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Implement authentication",
        description: "Set up JWT auth with refresh tokens",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: admin.id,
        projectId: project.id,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Build frontend components",
        description: "Create React components for the UI",
        status: "TODO",
        priority: "MEDIUM",
        assigneeId: member.id,
        projectId: project.id,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Write unit tests",
        description: "Add test coverage for API routes",
        status: "TODO",
        priority: "LOW",
        assigneeId: member.id,
        projectId: project.id,
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  console.log("Seed data created successfully");
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
