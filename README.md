# Team Task Manager

A full-stack task management application with team collaboration features, built with React, Express, Prisma, and SQLite.

## Features

- **User Authentication** — Register, login, JWT-based auth with refresh tokens
- **Project Management** — Create, update, delete projects with team members
- **Task Management** — Drag-and-drop Kanban board, priority levels, due dates, assignments
- **Role-Based Access** — Owner, Admin, Member roles per project
- **Dashboard** — Task summaries, overdue tasks, activity feed
- **Notifications** — In-app notifications for task assignments and updates
- **Activity Log** — Track all changes across projects

## Tech Stack

| Layer      | Technologies |
|------------|-------------|
| Frontend   | React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, dnd-kit, Recharts |
| Backend    | Express, TypeScript, Prisma ORM, Zod validation, JWT, bcrypt |
| Database   | SQLite (via Prisma) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

The backend runs on `http://localhost:3000` and the frontend on `http://localhost:5173`.

### Seed Data

```bash
cd backend
npm run prisma:seed
```

Seeds the database with sample users, projects, and tasks.

### Login Credentials

| Role   | Email              | Password     |
|--------|--------------------|--------------|
| Admin  | admin@example.com  | Admin1234    |
| Member | member@example.com | Member1234   |

## Project Structure

```
backend/
├── prisma/          # Schema & migrations
├── src/
│   ├── middleware/   # Auth, RBAC, error handler
│   ├── routes/       # API route handlers
│   ├── utils/        # JWT, password hashing, errors
│   ├── validators/   # Zod schemas
│   └── index.ts      # Express app entry
frontend/
├── src/
│   ├── api/          # Axios client & API functions
│   ├── components/   # Reusable UI components
│   ├── context/      # Auth context
│   ├── pages/        # Route pages
│   └── main.tsx      # App entry
```

## API Endpoints

| Method | Endpoint                  | Description |
|--------|---------------------------|-------------|
| POST   | `/api/auth/register`      | Register user |
| POST   | `/api/auth/login`         | Login |
| POST   | `/api/auth/refresh`       | Refresh tokens |
| POST   | `/api/auth/logout`        | Logout |
| GET    | `/api/auth/me`            | Current user |
| GET    | `/api/projects`           | List projects |
| POST   | `/api/projects`           | Create project |
| PATCH  | `/api/projects/:id`       | Update project |
| DELETE | `/api/projects/:id`       | Delete project |
| GET    | `/api/projects/:id/tasks` | List tasks |
| POST   | `/api/projects/:id/tasks` | Create task |
| PATCH  | `/api/tasks/:id`          | Update task |
| DELETE | `/api/tasks/:id`          | Delete task |
| GET    | `/api/dashboard/summary`  | Dashboard stats |

## License

MIT
