const { getDbSafe } = require('../database/db');

exports.summary = async (req, res) => {
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    const taskStats = isAdmin
      ? db.prepare(`SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status='todo' THEN 1 ELSE 0 END) as todo,
          SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status='review' THEN 1 ELSE 0 END) as review,
          SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
          SUM(CASE WHEN due_date < DATE('now') AND status!='done' THEN 1 ELSE 0 END) as overdue
        FROM tasks`).get()
      : db.prepare(`SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status='todo' THEN 1 ELSE 0 END) as todo,
          SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status='review' THEN 1 ELSE 0 END) as review,
          SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
          SUM(CASE WHEN due_date < DATE('now') AND status!='done' THEN 1 ELSE 0 END) as overdue
        FROM tasks WHERE assignee_id = ?`).get(userId);

    const projectStats = isAdmin
      ? db.prepare('SELECT COUNT(*) as total FROM projects').get()
      : db.prepare('SELECT COUNT(*) as total FROM project_members WHERE user_id = ?').get(userId);

    res.json({
      taskStats: {
        total: taskStats.total || 0,
        todo: taskStats.todo || 0,
        inProgress: taskStats.in_progress || 0,
        review: taskStats.review || 0,
        done: taskStats.done || 0,
        overdue: taskStats.overdue || 0
      },
      projectStats: {
        total: projectStats.total || 0
      }
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: true, message: 'Failed to load dashboard summary' });
  }
};

exports.myTasks = async (req, res) => {
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    const tasks = db.prepare(`
      SELECT t.*, p.title as project_title
      FROM tasks t JOIN projects p ON t.project_id = p.id
      WHERE t.assignee_id = ? AND t.status != 'done'
      ORDER BY t.due_date ASC, t.priority DESC
      LIMIT 10
    `).all(req.user.id);
    res.json({
      tasks: tasks.map(t => ({
        id: t.id, title: t.title, status: t.status, priority: t.priority,
        projectId: t.project_id, assigneeId: t.assignee_id,
        dueDate: t.due_date, projectTitle: t.project_title
      }))
    });
  } catch (err) {
    console.error('My tasks error:', err);
    res.status(500).json({ error: true, message: 'Failed to load my tasks' });
  }
};

exports.overdue = async (req, res) => {
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    const isAdmin = req.user.role === 'ADMIN';
    const tasks = isAdmin
      ? db.prepare(`
          SELECT t.*, u.name as assignee_name, p.title as project_title
          FROM tasks t JOIN projects p ON t.project_id = p.id
          LEFT JOIN users u ON t.assignee_id = u.id
          WHERE t.due_date < DATE('now') AND t.status != 'done'
          ORDER BY t.due_date ASC LIMIT 10
        `).all()
      : db.prepare(`
          SELECT t.*, u.name as assignee_name, p.title as project_title
          FROM tasks t JOIN projects p ON t.project_id = p.id
          LEFT JOIN users u ON t.assignee_id = u.id
          WHERE t.due_date < DATE('now') AND t.status != 'done'
          AND t.assignee_id = ?
          ORDER BY t.due_date ASC LIMIT 10
        `).all(req.user.id);
    res.json({
      tasks: tasks.map(t => ({
        id: t.id, title: t.title, status: t.status, priority: t.priority,
        projectId: t.project_id, assigneeId: t.assignee_id,
        dueDate: t.due_date, assigneeName: t.assignee_name,
        projectTitle: t.project_title
      }))
    });
  } catch (err) {
    console.error('Overdue tasks error:', err);
    res.status(500).json({ error: true, message: 'Failed to load overdue tasks' });
  }
};