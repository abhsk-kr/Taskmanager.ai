import request from "supertest";
import app from "../index.js";
import { prisma } from "../index.js";
import { hashPassword } from "../utils/password.js";

let accessToken = "";
let adminToken = "";
let testProjectId = "";
let testTaskId = "";
let testUserId = "";

beforeAll(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany({ where: { email: { in: ["test@test.com", "admin@test.com", "member2@test.com"] } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Auth Flow", () => {
  test("POST /api/auth/register - creates user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email: "test@test.com", password: "Test1234" });
    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.accessToken).toBeDefined();
    accessToken = res.body.accessToken;
    testUserId = res.body.user.id;
  });

  test("POST /api/auth/register - rejects duplicate email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email: "test@test.com", password: "Test1234" });
    expect(res.status).toBe(400);
  });

  test("POST /api/auth/register - rejects weak password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test", email: "weak@test.com", password: "weak" });
    expect(res.status).toBe(400);
  });

  test("POST /api/auth/login - logs in", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@test.com", password: "Test1234" });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    accessToken = res.body.accessToken;
  });

  test("POST /api/auth/login - rejects wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@test.com", password: "WrongPass1" });
    expect(res.status).toBe(401);
  });

  test("GET /api/auth/me - returns current user", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("test@test.com");
  });
});

describe("Projects", () => {
  test("POST /api/projects - creates project", async () => {
    const res = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Test Project", description: "A test project" });
    expect(res.status).toBe(201);
    expect(res.body.project).toBeDefined();
    testProjectId = res.body.project.id;
  });

  test("GET /api/projects - lists projects", async () => {
    const res = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.projects.length).toBeGreaterThan(0);
  });

  test("POST /api/projects/:id/members - adds member", async () => {
    const adminPass = await hashPassword("Admin1234");
    await prisma.user.create({
      data: { name: "Admin", email: "admin@test.com", password: adminPass, role: "ADMIN" },
    });
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: "Admin1234" });
    adminToken = loginRes.body.accessToken;

    const res = await request(app)
      .post(`/api/projects/${testProjectId}/members`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "test@test.com", role: "MEMBER" });
    expect(res.status).toBe(400); // already a member (owner)
  });
});

describe("Tasks", () => {
  test("POST /api/projects/:id/tasks - creates task", async () => {
    const res = await request(app)
      .post(`/api/projects/${testProjectId}/tasks`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Test Task", priority: "HIGH" });
    expect(res.status).toBe(201);
    expect(res.body.task).toBeDefined();
    testTaskId = res.body.task.id;
  });

  test("GET /api/projects/:id/tasks - lists tasks", async () => {
    const res = await request(app)
      .get(`/api/projects/${testProjectId}/tasks`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBeGreaterThan(0);
  });

  test("PATCH /api/tasks/:id/status - forward transition", async () => {
    const res = await request(app)
      .patch(`/api/tasks/${testTaskId}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "IN_PROGRESS" });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe("IN_PROGRESS");
  });

  test("PATCH /api/tasks/:id/status - blocks backward transition", async () => {
    const res = await request(app)
      .patch(`/api/tasks/${testTaskId}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "TODO" });
    expect(res.status).toBe(400);
  });

  test("PATCH /api/tasks/:id - updates task", async () => {
    const res = await request(app)
      .patch(`/api/tasks/${testTaskId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Updated Task" });
    expect(res.status).toBe(200);
    expect(res.body.task.title).toBe("Updated Task");
  });
});

describe("Dashboard", () => {
  test("GET /api/dashboard/summary", async () => {
    const res = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalTasks).toBeDefined();
  });

  test("GET /api/dashboard/my-tasks", async () => {
    const res = await request(app)
      .get("/api/dashboard/my-tasks")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });
});

describe("RBAC", () => {
  test("GET /api/users - blocks non-admin", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });

  test("GET /api/users - allows admin", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test("DELETE /api/projects/:id - blocks with open tasks", async () => {
    const res = await request(app)
      .delete(`/api/projects/${testProjectId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});

describe("CSV Export", () => {
  test("GET /api/projects/:id/tasks/export", async () => {
    const res = await request(app)
      .get(`/api/projects/${testProjectId}/tasks/export`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("text/csv");
  });
});
