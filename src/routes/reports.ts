import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { blockMaid, getBlockMaidByUser, getBlockMaids, getReportMaids, reportMaid, unblockMaid } from '../controllers/report.controller.js';
import { requireAdmin } from '../middleware/admin.js';


const router = express.Router();

router.use(authenticateToken);

router.post('/', reportMaid);
router.post('/maids/:maid_id/block',blockMaid);
router.delete('/maids/:maid_id/block', unblockMaid);
router.get("/user/:userId/blocked-maids", getBlockMaidByUser);

router.get('/maids/reports',requireAdmin, getReportMaids);
router.get('/maids/blocked,',requireAdmin, getBlockMaids);


export default router;