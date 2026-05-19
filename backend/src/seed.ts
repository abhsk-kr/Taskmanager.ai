import { PrismaClient } from "@prisma/client";
import { hashPassword } from "./utils/password.js";

const prisma = new PrismaClient();

async function seed() {
  const existingAdmin = await prisma.user.findUnique({ where: { email: "admin@example.com" } });
  const existingMember = await prisma.user.findUnique({ where: { email: "member@example.com" } });

  if (existingAdmin && existingMember) {
    console.log("Seed data already exists, skipping");
    await prisma.$disconnect();
    return;
  }

  const adminPassword = await hashPassword("Admin1234");
  const memberPassword = await hashPassword("Member1234");

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { name: "Admin User", password: adminPassword, role: "ADMIN" },
    create: {
      name: "Admin User",
      email: "admin@example.com",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  const member = await prisma.user.upsert({
    where: { email: "member@example.com" },
    update: { name: "John Member", password: memberPassword, role: "MEMBER" },
    create: {
      name: "John Member",
      email: "member@example.com",
      password: memberPassword,
      role: "MEMBER",
    },
  });

  const existingProject = await prisma.project.findFirst({
    where: { title: "Sample Project", ownerId: admin.id },
  });

  if (existingProject) {
    console.log("Seed data already exists, skipping");
    await prisma.$disconnect();
    return;
  }

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
