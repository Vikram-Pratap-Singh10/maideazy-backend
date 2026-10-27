import express from 'express';
import { body } from 'express-validator';
import { register, login, verifyOtp, logout, pincode, imageUpload, newUserLogin, skipButton, registerUserByAdmin, test } from '../controllers/authController.js';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

const registerValidation = [
  body('fullName').isLength({ min: 2 }).withMessage('Full Name required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('phone').notEmpty().withMessage('Valid phone required')
  // body('phone').isMobilePhone('en-IN').withMessage('Valid phone required')
]
const logiValidation = [
  body('phone').notEmpty().withMessage('Valid Phone required'),
]
// New User
router.post("/new-user", newUserLogin)
router.get("/skip-button", skipButton)
router.get("/test", test)

router.post('/register-user', registerValidation, registerUserByAdmin);
router.post('/register', registerValidation, register);
router.post('/login', login);
router.post("/verify-otp",upload.single("image"), verifyOtp)
router.post("/image-upload",upload.single("image"), imageUpload)
router.post('/logout', authenticateToken, upload.single("image"), logout);
router.post('/pincode', pincode);

export default router;
