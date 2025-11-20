import { Router } from 'express';
import { db } from '../config/database.js';

const router = Router();

/**
 * Get all users
 * GET /api/users
 */
router.get('/', (req, res) => {
  try {
    const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get user by ID
 * GET /api/users/:id
 */
router.get('/:id', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create user
 * POST /api/users
 */
router.post('/', (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required'
      });
    }

    const stmt = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
    const result = stmt.run(name, email);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        success: false,
        error: 'Email already exists'
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update user
 * PUT /api/users/:id
 */
router.put('/:id', (req, res) => {
  try {
    const { name, email } = req.body;

    // Check if user exists
    const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existingUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Update user
    const stmt = db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?');
    stmt.run(name || existingUser.name, email || existingUser.email, req.params.id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

    res.json({ success: true, data: user });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        success: false,
        error: 'Email already exists'
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete user
 * DELETE /api/users/:id
 */
router.delete('/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
