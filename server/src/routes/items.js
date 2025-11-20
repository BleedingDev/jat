import { Router } from 'express';
import { db } from '../config/database.js';

const router = Router();

/**
 * Get all items
 * GET /api/items
 */
router.get('/', (req, res) => {
  try {
    const { user_id, status } = req.query;
    let query = 'SELECT * FROM items';
    const params = [];

    if (user_id || status) {
      query += ' WHERE';
      const conditions = [];

      if (user_id) {
        conditions.push(' user_id = ?');
        params.push(user_id);
      }

      if (status) {
        conditions.push(' status = ?');
        params.push(status);
      }

      query += conditions.join(' AND');
    }

    query += ' ORDER BY created_at DESC';

    const items = db.prepare(query).all(...params);
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get item by ID
 * GET /api/items/:id
 */
router.get('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create item
 * POST /api/items
 */
router.post('/', (req, res) => {
  try {
    const { user_id, title, description, status } = req.body;

    if (!user_id || !title) {
      return res.status(400).json({
        success: false,
        error: 'user_id and title are required'
      });
    }

    // Check if user exists
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const stmt = db.prepare(`
      INSERT INTO items (user_id, title, description, status)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(user_id, title, description || null, status || 'pending');

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update item
 * PUT /api/items/:id
 */
router.put('/:id', (req, res) => {
  try {
    const { title, description, status } = req.body;

    // Check if item exists
    const existingItem = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!existingItem) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    // Update item
    const stmt = db.prepare(`
      UPDATE items
      SET title = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      title || existingItem.title,
      description !== undefined ? description : existingItem.description,
      status || existingItem.status,
      req.params.id
    );

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);

    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete item
 * DELETE /api/items/:id
 */
router.delete('/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM items WHERE id = ?');
    const result = stmt.run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
