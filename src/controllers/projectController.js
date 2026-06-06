const { getDbSafe } = require('../database/db');

const toCamelProject = (p) => p ? {
  id: p.id, title: p.title, description: p.description,
  deadline: p.deadline, ownerId: p.owner_id,
  createdAt: p.created_at, updatedAt: p.updated_at
} : null;

exports.list = async (req, res) => {
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    let projects;
    if (req.user.role === 'ADMIN') {
      projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    } else {
      projects = db.prepare(`
        SELECT p.* FROM projects p
        JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
        ORDER BY p.created_at DESC
      `).all(req.user.id);
    }
    const result = projects.map(p => {
      const tasks = db.prepare('SELECT id, title, status, priority, assignee_id, due_date FROM tasks WHERE project_id = ?').all(p.id);
      const members = db.prepare(`
        SELECT u.id, u.name, u.email, u.role, u.avatar, pm.role as member_role, pm.joined_at
        FROM project_members pm JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = ? ORDER BY u.name
      `).all(p.id);
      return {
        ...toCamelProject(p),
        tasks: tasks.map(t => ({
          id: t.id, title: t.title, status: t.status, priority: t.priority,
          assigneeId: t.assignee_id, dueDate: t.due_date
        })),
        members: members.map(m => ({
          id: m.id, name: m.name, email: m.email, role: m.role,
          avatar: m.avatar, membershipRole: m.member_role
        })),
        _count: { tasks: tasks.length, members: members.length }
      };
    });
    res.json({ projects: result });
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: true, message: 'Failed to fetch projects' });
  }
};

exports.create = async (req, res) => {
  const { title, description, deadline } = req.body;
  if (!title) return res.status(400).json({ error: true, message: 'Title is required' });
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    const result = db.prepare('INSERT INTO projects (title, description, deadline, owner_id) VALUES (?, ?, ?, ?)')
      .run(title, description || null, deadline || null, req.user.id);
    db.prepare("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'ADMIN')")
      .run(result.lastInsertRowid, req.user.id);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ ...toCamelProject(project), tasks: [], members: [], _count: { tasks: 0, members: 1 } });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: true, message: 'Failed to create project' });
  }
};

exports.update = async (req, res) => {
  const { title, description, deadline } = req.body;
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: true, message: 'Project not found' });
    const newTitle = title !== undefined ? title : existing.title;
    const newDesc = description !== undefined ? description : existing.description;
    const newDeadline = deadline !== undefined ? deadline : existing.deadline;
    db.prepare('UPDATE projects SET title = ?, description = ?, deadline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newTitle, newDesc, newDeadline, req.params.id);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json(toCamelProject(project));
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: true, message: 'Failed to update project' });
  }
};

exports.remove = async (req, res) => {
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: true, message: 'Failed to delete project' });
  }
};

exports.getMembers = async (req, res) => {
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    const members = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.avatar, pm.role as member_role, pm.joined_at
      FROM project_members pm JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ? ORDER BY u.name
    `).all(req.params.id);
    res.json({
      members: members.map(m => ({
        id: m.id, name: m.name, email: m.email, role: m.role,
        avatar: m.avatar, membershipRole: m.member_role, joinedAt: m.joined_at
      }))
    });
  } catch (err) {
    console.error('Get members error:', err);
    res.status(500).json({ error: true, message: 'Failed to fetch members' });
  }
};

exports.addMember = async (req, res) => {
  const { userId, role } = req.body;
  if (!userId) return res.status(400).json({ error: true, message: 'userId is required' });
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: true, message: 'User not found' });
    const existing = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, userId);
    if (existing) return res.status(409).json({ error: true, message: 'User already a member' });
    const memberRole = role || 'MEMBER';
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(req.params.id, userId, memberRole);
    res.status(201).json({ message: `${user.name} added to project` });
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ error: true, message: 'Failed to add member' });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: true, message: 'Failed to remove member' });
  }
};