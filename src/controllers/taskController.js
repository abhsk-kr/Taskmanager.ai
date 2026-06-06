const { getDbSafe } = require('../database/db');

const toCamelTask = (t) => t ? {
  id: t.id, title: t.title, description: t.description,
  status: t.status, priority: t.priority,
  projectId: t.project_id, assigneeId: t.assignee_id,
  dueDate: t.due_date,
  createdAt: t.created_at, updatedAt: t.updated_at
} : null;

exports.list = async (req, res) => {
  const { priority } = req.query;
  const projectId = req.params.projectId;
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    let query = 'SELECT * FROM tasks WHERE project_id = ?';
    const params = [projectId];
    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }
    query += ' ORDER BY created_at DESC';
    const tasks = db.prepare(query).all(...params);
    res.json({ tasks: tasks.map(toCamelTask) });
  } catch (err) {
    console.error('List tasks error:', err);
    res.status(500).json({ error: true, message: 'Failed to fetch tasks' });
  }
};

exports.create = async (req, res) => {
  const { title, description, priority, assigneeId, dueDate } = req.body;
  const projectId = req.params.projectId;
  if (!title) return res.status(400).json({ error: true, message: 'Title is required' });
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: true, message: 'Project not found' });
    const result = db.prepare(
      'INSERT INTO tasks (title, description, priority, project_id, assignee_id, due_date) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(title, description || null, priority || 'medium', projectId, assigneeId || null, dueDate || null);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(toCamelTask(task));
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: true, message: 'Failed to create task' });
  }
};

exports.update = async (req, res) => {
  const { title, description, status, priority, assigneeId, dueDate } = req.body;
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: true, message: 'Task not found' });
    db.prepare(`
      UPDATE tasks SET
        title = ?, description = ?, status = ?, priority = ?,
        assignee_id = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title !== undefined ? title : existing.title,
      description !== undefined ? description : existing.description,
      status !== undefined ? status : existing.status,
      priority !== undefined ? priority : existing.priority,
      assigneeId !== undefined ? assigneeId : existing.assignee_id,
      dueDate !== undefined ? dueDate : existing.due_date,
      req.params.id
    );
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(toCamelTask(task));
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: true, message: 'Failed to update task' });
  }
};

exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  if (!['todo', 'in_progress', 'review', 'done'].includes(status)) {
    return res.status(400).json({ error: true, message: 'Invalid status' });
  }
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    db.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(toCamelTask(task));
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: true, message: 'Failed to update status' });
  }
};

exports.remove = async (req, res) => {
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: true, message: 'Failed to delete task' });
  }
};