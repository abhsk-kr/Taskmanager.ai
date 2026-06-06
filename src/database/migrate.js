const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs-extra');

const dbDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
const dbPath = path.join(dbDir, 'taskmanager.db');

let _sqlDb;
let saveTimeout;

function persistDB() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (!_sqlDb) return;
    try {
      const data = _sqlDb.export();
      fs.ensureDirSync(dbDir);
      fs.writeFileSync(dbPath, Buffer.from(data));
    } catch (err) {
      console.error('Failed to persist database:', err.message);
    }
  }, 500);
}

function createWrapper(sqlDb) {
  const handleError = (operation, err) => {
    console.error(`Database ${operation} error:`, err.message);
    throw err;
  };
  return {
    prepare: (sql) => ({
      run: (...params) => {
        try {
          sqlDb.run(sql, params);
          persistDB();
          const [{ values }] = sqlDb.exec('SELECT last_insert_rowid()');
          return { lastInsertRowid: values[0][0], changes: 1 };
        } catch (err) { handleError('run', err); }
      },
      get: (...params) => {
        try {
          const result = sqlDb.exec(sql, params);
          if (!result.length || !result[0].values.length) return undefined;
          const { columns, values } = result[0];
          return Object.fromEntries(columns.map((c, i) => [c, values[0][i]]));
        } catch (err) { handleError('get', err); }
      },
      all: (...params) => {
        try {
          const result = sqlDb.exec(sql, params);
          if (!result.length) return [];
          const { columns, values } = result[0];
          return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
        } catch (err) { handleError('all', err); }
      }
    }),
    exec: (sql) => {
      try {
        sqlDb.run(sql);
        persistDB();
      } catch (err) { handleError('exec', err); }
    },
    pragma: () => {},
    close: () => sqlDb.close()
  };
}

let resolveDb;
let rejectDb;
const dbReady = new Promise((resolve, reject) => {
  resolveDb = resolve;
  rejectDb = reject;
});

async function init() {
  const SQL = await initSqlJs();
  let sqlDb;
  const dbExists = fs.existsSync(dbPath);
  if (dbExists) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      sqlDb = new SQL.Database(fileBuffer);
    } catch (err) {
      console.error('Corrupt database file, creating fresh:', err.message);
      sqlDb = new SQL.Database();
    }
  } else {
    fs.ensureDirSync(dbDir);
    sqlDb = new SQL.Database();
  }
  _sqlDb = sqlDb;
  const db = createWrapper(sqlDb);
  runMigrations(sqlDb);
  persistDB();
  return db;
}

function runMigrations(sqlDb) {
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'MEMBER' CHECK(role IN ('ADMIN', 'MEMBER')),
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      deadline TEXT,
      owner_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'MEMBER' CHECK(role IN ('ADMIN', 'MEMBER', 'VIEWER')),
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(project_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'review', 'done')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      project_id INTEGER NOT NULL,
      assignee_id INTEGER,
      due_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  console.log('✅ Database migrations complete');
}

init()
  .then(db => { resolveDb(db); })
  .catch(err => {
    console.error('❌ Database initialization failed:', err);
    rejectDb(err);
  });

module.exports = dbReady;