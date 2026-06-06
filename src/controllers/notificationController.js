const { getDbSafe } = require('../database/db');

exports.list = async (req, res) => {
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    const notifications = db.prepare(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(req.user.id);
    res.json({
      notifications: notifications.map(n => ({
        id: n.id, title: n.title, message: n.message,
        read: n.read === 1, createdAt: n.created_at
      }))
    });
  } catch (err) {
    console.error('List notifications error:', err);
    res.status(500).json({ error: true, message: 'Failed to fetch notifications' });
  }
};

exports.readAll = async (req, res) => {
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Read all error:', err);
    res.status(500).json({ error: true, message: 'Failed to mark notifications as read' });
  }
};

exports.read = async (req, res) => {
  try {
    const db = await getDbSafe(res);
    if (!db) return;
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Read notification error:', err);
    res.status(500).json({ error: true, message: 'Failed to mark notification as read' });
  }
};
