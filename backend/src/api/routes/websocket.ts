import { Router } from 'express';
import { wsManager } from '../../websocket/server';

const router = Router();

/**
 * @swagger
 * /api/websocket/stats:
 *   get:
 *     tags: [WebSocket]
 *     summary: Get WebSocket server statistics
 *     description: Returns connection statistics and active subscriptions
 *     responses:
 *       200:
 *         description: WebSocket statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connectedClients:
 *                   type: number
 *                   description: Number of connected clients
 *                 activeSubscriptions:
 *                   type: number
 *                   description: Number of active subscription channels
 *                 subscriptionDetails:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       event:
 *                         type: string
 *                         description: Subscription event name
 *                       subscriberCount:
 *                         type: number
 *                         description: Number of subscribers to this event
 *       500:
 *         description: Internal server error
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = wsManager.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting WebSocket stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get WebSocket stats'
    });
  }
});

/**
 * @swagger
 * /api/websocket/test:
 *   post:
 *     tags: [WebSocket]
 *     summary: Test WebSocket broadcasting
 *     description: Send a test message to all connected clients (development only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 description: Message type
 *                 example: "test"
 *               data:
 *                 type: object
 *                 description: Message data
 *                 example: { "message": "Hello WebSocket!" }
 *     responses:
 *       200:
 *         description: Test message sent successfully
 *       400:
 *         description: Invalid request body
 *       403:
 *         description: Not allowed in production
 *       500:
 *         description: Internal server error
 */
router.post('/test', async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Test endpoint not available in production'
      });
    }

    const { type, data } = req.body;

    if (!type || !data) {
      return res.status(400).json({
        success: false,
        error: 'Type and data are required'
      });
    }

    // Broadcast test message based on type
    switch (type) {
      case 'token:update':
        wsManager.broadcastTokenUpdate(data.address || 'test-token', data);
        break;
      case 'trade:new':
        wsManager.broadcastNewTrade(data);
        break;
      case 'token:new':
        wsManager.broadcastNewToken(data);
        break;
      case 'stats:update':
        wsManager.broadcastStatsUpdate(data);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown message type: ${type}`
        });
    }

    res.json({
      success: true,
      message: `Test message of type '${type}' sent to all subscribers`
    });
  } catch (error) {
    console.error('Error sending test WebSocket message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test message'
    });
  }
});

export default router;