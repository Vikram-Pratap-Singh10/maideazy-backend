import express from 'express'
import { getMessages, SendMessage } from '../controllers/messageController.js';

const router = express.Router();

router.post("/send-messages", SendMessage);
router.post("/get-messages", getMessages);


export default router;