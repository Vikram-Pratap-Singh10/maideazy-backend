import express from 'express';
import multer from "multer"
import { body } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { getProfile, updateProfile, addAddress, getAddresses, updateAddress, deleteAddress, getAllUserForAdmin, getUserByIdForAdmin, getUserOffer, deleteAccount, updateSelectAddress, walletAmountUpdate, NotServiceUser, updateUserByAdmin, addAddressByAdmin, getAddressesByAdmin, updateAddressByAdmin, deleteAddressByAdmin } from '../controllers/userController.js';
import { requireAdmin } from '../middleware/admin.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.use(authenticateToken);

const profileValidation = [
  body('fullName').optional().isLength({ min: 2 }).withMessage('Full Name min 2 chars'),
  body('phone').optional().notEmpty().withMessage('Valid phone required'),
  body('email').optional().notEmpty().withMessage('Valid email required'),
]
const addressValidation = [
  body('house').notEmpty().withMessage('House required'),
  body('city').notEmpty().withMessage('City required'),
  body('state').notEmpty().withMessage('State required'),
  body('pincode').notEmpty().withMessage('Pincode required'),
]
// get new user offer by user
router.get('/get/new-offer', getUserOffer);

// Get user profile
router.get('/profile', getProfile);
// Update user profile
// router.patch('/profile', profileValidation, updateProfile);
router.patch('/profile', profileValidation, upload.single("file"), updateProfile);

// Add new address
router.post('/addresses', addressValidation, addAddress);
// Get all addresses
router.get('/addresses', getAddresses);
// Update address
router.patch('/addresses/selected/:addressId', updateSelectAddress);
router.patch('/addresses/:addressId', updateAddress);
// Delete address
router.delete('/addresses/:addressId', deleteAddress);

// Account Delete
router.post("/account-delete", deleteAccount)

// Get All User List For Admin
router.get("/all-user", requireAdmin, getAllUserForAdmin)
router.get("/:userId", requireAdmin, getUserByIdForAdmin)
router.put('/wallet-balance-add/:id', requireAdmin, walletAmountUpdate);
router.put('/admin/user-edit/:userId', updateUserByAdmin);
// Add new address
router.post('/admin/addresses/:userId', addressValidation, addAddressByAdmin);
// Get all addresses
router.get('/admin/addresses/:userId', getAddressesByAdmin);
// Update address
router.patch('/admin/addresses/:userId/:addressId', updateAddressByAdmin);
// Delete address
router.delete('/admin/addresses/:userId/:addressId', deleteAddressByAdmin);

// there service not available user list
router.get("/unserviceable/users", requireAdmin,NotServiceUser)

export default router;
