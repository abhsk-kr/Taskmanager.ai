const { getDb } = require('./db');
const bcrypt = require('bcryptjs');

const seed = async () => {
  let db;
  try {
    db = await getDb();
  } catch (err) {
    console.error('Seed skipped: database unavailable:', err.message);
    return;
  }
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existing.count > 0) { console.log('Database already seeded'); return; }

  const hashedAdmin = await bcrypt.hash('Admin1234', 12);
  const hashedMember = await bcrypt.hash('Member123', 12);

  const admin = db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'ADMIN')")
    .run('Admin User', 'admin@example.com', hashedAdmin);
  const bob = db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'MEMBER')")
    .run('Bob Builder', 'bob@example.com', hashedMember);
  const carol = db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'MEMBER')")
    .run('Carol Dev', 'carol@example.com', hashedMember);

  const p1 = db.prepare('INSERT INTO projects (title, description, deadline, owner_id) VALUES (?, ?, ?, ?)')
    .run('Website Redesign', 'Complete overhaul of company website', '2026-06-30', admin.lastInsertRowid);
  const p2 = db.prepare('INSERT INTO projects (title, description, deadline, owner_id) VALUES (?, ?, ?, ?)')
    .run('Mobile App v2', 'Next version of mobile application', '2026-07-15', admin.lastInsertRowid);

  const am = db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)');
  am.run(p1.lastInsertRowid, admin.lastInsertRowid, 'ADMIN');
  am.run(p1.lastInsertRowid, bob.lastInsertRowid, 'MEMBER');
  am.run(p1.lastInsertRowid, carol.lastInsertRowid, 'MEMBER');
  am.run(p2.lastInsertRowid, admin.lastInsertRowid, 'ADMIN');
  am.run(p2.lastInsertRowid, bob.lastInsertRowid, 'MEMBER');

  const at = db.prepare(
    'INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  at.run('Design new homepage', 'Wireframes and mockups', 'done', 'high', p1.lastInsertRowid, carol.lastInsertRowid, '2026-05-10');
  at.run('Implement navigation', 'Responsive nav component', 'in_progress', 'high', p1.lastInsertRowid, bob.lastInsertRowid, '2026-05-20');
  at.run('Write content strategy', 'SEO and content plan', 'todo', 'medium', p1.lastInsertRowid, null, '2026-06-01');
  at.run('Setup CI/CD pipeline', 'Automated deployment', 'review', 'critical', p1.lastInsertRowid, bob.lastInsertRowid, '2026-04-25');
  at.run('User authentication flow', 'Login, signup, OAuth', 'in_progress', 'critical', p2.lastInsertRowid, carol.lastInsertRowid, '2026-05-15');
  at.run('Push notification system', 'Firebase integration', 'todo', 'high', p2.lastInsertRowid, bob.lastInsertRowid, '2026-06-01');

  console.log('Seed complete!');
  console.log('  Admin: admin@example.com / Admin1234');
  console.log('  Member: bob@example.com / Member123');
};

module.exports = seed;
