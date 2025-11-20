import { Router } from 'express';
import { db } from '../config/database.js';

const router = Router();

/**
 * Health check endpoint
 * GET /health
 */
router.get('/', (req, res) => {
  try {
    // Test database connection
    const result = db.prepare('SELECT 1 as test').get();

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: result.test === 1 ? 'connected' : 'error'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

export default router;
