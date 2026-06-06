const dbReady = require('../database/migrate');

let _db;
let _dbError;

const getDb = async () => {
  if (_db) return _db;
  if (_dbError) throw _dbError;
  try {
    _db = await dbReady;
    return _db;
  } catch (err) {
    _dbError = err;
    throw err;
  }
};

const getDbSafe = async (res) => {
  try {
    return await getDb();
  } catch (err) {
    console.error('Database unavailable:', err.message);
    if (res && !res.headersSent) {
      res.status(500).json({ success: false, message: 'Database unavailable. Please try again later.' });
    }
    return null;
  }
};

module.exports = { getDb, getDbSafe };
