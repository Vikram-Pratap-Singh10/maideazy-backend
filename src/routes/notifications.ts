import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { deleteNotification, getNotifications, getUnReadNotifications, getUnReadNotificationsByMaid, markAsRead } from '../controllers/notification.controller.js';

const router = express.Router();
router.use(authenticateToken)

router.get('/', getNotifications);
router.get('/unread-count', getUnReadNotifications);
router.get('/maid/unread-count', getUnReadNotificationsByMaid);
router.delete('/:id', deleteNotification);
router.put('/:id/read', markAsRead);

export default router;