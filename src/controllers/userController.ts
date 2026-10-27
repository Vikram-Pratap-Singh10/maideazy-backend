import { validationResult } from 'express-validator';
import { Request, Response } from 'express';
import User from '../models/User.js';
import cloudinary from '../middleware/cloudinary.js';
import Booking from '../models/Booking.js';
import mongoose from 'mongoose';
import Maid from '../models/Maid.js';
import Building from '../models/Building.js';
import Setting from '../models/Setting.js';

interface MulterFile extends Express.Multer.File {
  buffer: Buffer;
}

// export const checkBlockedUser = async (req: any, res: any, next: any) => {
//   try {
//     const userId = req.user._id;

//     const user = await User.findById(userId).select("isBlock");

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     if (user.isBlock) {
//       return res.status(403).json({
//         success: false,
//         message: "Your account is blocked by admin.",
//       });
//     }

//     next();
//   } catch (error) {
//     next(error);
//   }
// };

// get if user purchase new user offer

export const getUserOffer1 = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    const user = await User.findById(userId).select('_id freeOffer');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found', });
      return;
    }
    if (user.freeOffer && Object.keys(user.freeOffer).length === 0) {
      res.status(404).json({ success: false, message: 'Offer not found', });
      return;
    }
    res.status(200).json({ success: true, data: user.freeOffer, });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', });
  }
};
export const getUserOffer = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;

    const user = await User.findById(userId).select('_id freeOffer');

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found', });
      return;
    }

    const offer = user.freeOffer;

    // ❌ If no offer
    if (!offer || Object.keys(offer).length === 0) {
      res.status(404).json({ success: false, message: 'Offer not found', });
      return;
    }

    const currentDate = new Date();

    // ❌ Check expiry
    if (offer.validityDays && new Date(offer.validityDays) < currentDate) {
      res.status(404).json({ success: false, message: 'Offer expired', });
      return;
    }

    const freeBookings = offer.freeBookings ?? 0;
    const bookingsLimit = offer.bookingsLimit ?? 0;

    if (freeBookings >= bookingsLimit) {
      res.status(404).json({ success: false, message: 'Offer limit reached', });
      return;
    }

    // ✅ Valid offer
    res.status(200).json({ success: true, data: offer, });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', });
  }
};


// Get user profile
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    const maidId = (req as any).user.maidId
    const user = await User.findById(userId).select('_id fullName email wallet_balance addresses phone profile_image isNewUser registerDate offerBookingCount pushTokens freeOffer');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const setting = await Setting.findOne()
    let isNewOffer = (setting?.isNewOffer) ? true : false
    res.status(200).json({ success: true, data: { ...user.toObject(), isNewOffer, maidId } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
// Update user profile
export const updateProfile = async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  const file = req.file as MulterFile;
  if (file) {
    const imageUrl: string = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "maideazy/profile" },
        (error, result) => {
          if (error) return reject(error);
          if (result) return resolve(result.secure_url);
          reject(new Error("Upload failed"));
        }
      );
      uploadStream.end(file.buffer);
    });
    req.body.profile_image = imageUrl;
  }
  const userId = (req as any).user._id;
  const user = await User.findById(userId).select("isBlock isActive");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  if (user.isBlock) {
    return res.status(400).json({ success: false, message: "Your account is blocked. Please contact support.", });
  }
   if (!user.isActive) {
    return res.status(400).json({ success: false, message: "Your account is deactive or deleted.", });
  }
  const maidId = (req as any).user.maidId;
  const data = req.body;
  try {
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No data to update' });
    }
    if (req.body.pincode) {
      const availablePincode = await Building.findOne({ isActive: true, pincode: req.body.pincode });
      if (availablePincode) {
        req.body.serviceAvailable = true;
      }
    }
    const updatedProfile = await User.findByIdAndUpdate(userId, req.body, { new: true });
    if (!updatedProfile) {
      return res.status(400).json({ success: false, message: "something went wrong" })
    }
    if (maidId) {
      const updateMaid = { name: updatedProfile.fullName, email: updatedProfile.email, phone: updatedProfile.phone, profile_image: updatedProfile.profile_image }
      await Maid.findByIdAndUpdate(maidId, updateMaid, { new: true });
    }
    return res.json({ success: true, message: 'Profile updated', User: updatedProfile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
// Add address
export const addAddress = async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }
  const userId = (req as any).user._id;
  const user = await User.findById(userId).select("wallet_balance addresses bookingCount isBlock isActive");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  if (user.isBlock) {
    return res.status(400).json({ success: false, message: "Your account is blocked. Please contact support.", });
  }
   if (!user.isActive) {
    return res.status(400).json({ success: false, message: "Your account is deactive or deleted.", });
  }
  const { house, flat, city, state, pincode, wing_plot, building, street, latitude, longitude, hasPetOrCat, is_default } = req.body;
  // let serviceAvailable = false;
  const availablePincode = await Building.findOne({ isActive: true, pincode: pincode, name: building });
  if (!availablePincode) {
    res.status(400).json({ success: false, message: "Service is not available for this location" });
    return;
    // serviceAvailable = true;
  }
  try {
    if (is_default) {
      // Update other addresses to false
      await User.updateMany(
        { _id: userId, 'addresses.is_default': true }, { $set: { 'addresses.$[].is_default': false } })
    }

    const addressData = {
      house,
      flat: flat,
      city,
      wing_plot,
      state,
      pincode,
      building,
      street: street,
      hasPetOrCat,
      latitude: latitude,
      longitude: longitude,
      is_default: !!is_default
    };

    const user = await User.findByIdAndUpdate(userId, { $push: { addresses: addressData } }, { new: true });

    const newAddress = user?.addresses[user.addresses.length - 1];
    return res.status(201).json({ success: true, message: "Address Save Successful" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get addresses
export const getAddresses = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const user = await User.findById(userId).select('addresses');
    res.json({ success: true, data: user?.addresses || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update address
export const updateAddress = async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).user._id;
  const { addressId } = req.params;
  const user = await User.findById(userId).select("wallet_balance addresses bookingCount isBlock isActive");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  if (user.isBlock) {
    return res.status(400).json({ success: false, message: "Your account is blocked. Please contact support.", });
  }
  if (!user.isActive) {
    return res.status(400).json({ success: false, message: "Your account is deactive or deleted.", });
  }

  if (req.body.pincode) {
    // let serviceAvailable = false;
    const availablePincode = await Building.findOne({ isActive: true, pincode: req.body.pincode, name: req.body.building });
    if (!availablePincode) {
      res.status(400).json({ success: false, message: "Service is not available for this location" });
      return;
      // serviceAvailable = true;
    }
    if (availablePincode) {
      req.body.serviceAvailable = true;
    }
  }
  const data = req.body;
  try {
    // If new address is set as default → reset other defaults
    if (data.is_default) {
      await User.updateMany(
        { _id: userId, 'addresses.is_default': true },
        { $set: { 'addresses.$[].is_default': false } }
      );
    }
    // Build $set object dynamically
    const updateFields: any = {};
    for (const key in data) {
      updateFields[`addresses.$.${key}`] = data[key];
    }
    await User.updateOne({ _id: userId, 'addresses._id': addressId }, { $set: updateFields });
    return res.json({ success: true, message: 'Address updated' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update address
export const updateSelectAddress = async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).user._id;
  const { addressId } = req.params;

  const user = await User.findById(userId).select("wallet_balance addresses bookingCount isBlock isActive");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  if (user.isBlock) {
    return res.status(400).json({ success: false, message: "Your account is blocked. Please contact support.", });
  }
  if (!user.isActive) {
    return res.status(400).json({ success: false, message: "Your account is deactive or deleted.", });
  }
  try {
    // 1. Set all addresses to false
    await User.updateOne(
      { _id: userId },
      { $set: { "addresses.$[].is_default": false } }
    );

    // 2. Set selected address to true
    await User.updateOne(
      { _id: userId, "addresses._id": addressId },
      { $set: { "addresses.$.is_default": true } }
    );

    return res.json({ success: true, message: "Default address updated successfully" });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// Delete address
export const deleteAddress = async (req: Request, res: Response): Promise<any> => {
  const userId = (req as any).user._id;
  const { addressId } = req.params;
  try {
    await User.updateOne({ _id: userId }, { $pull: { addresses: { _id: addressId } } });
    return res.json({ success: true, message: 'Address deleted' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get All User List For Admin
export const getAllUserForAdmin1 = async (req: Request, res: Response): Promise<any> => {
  try {
    // Fetch all active users first
    const users = await User.find({
      role: "user", addresses: {
        $not: { $elemMatch: { serviceAvailable: false } }
      }
    }).sort({ createdAt: -1 }).lean();

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "Users Not Found" });
    }

    // Aggregate booking counts and total amounts in ONE query
    const bookingStats = await Booking.aggregate([
      {
        $group: {
          _id: "$user_id",
          bookingCount: { $sum: 1 },
          totalAmount: { $sum: "$total_amount" } // assuming field name is total_amount
        }
      }
    ]);

    // Create a lookup map for fast merging
    const statsMap = new Map(
      bookingStats.map(stat => [stat._id.toString(), stat])
    );

    // Merge user data with their booking stats
    const maidWithStats = users.map(user => {
      const stat = statsMap.get(user._id.toString());
      return {
        ...user,
        bookingCount: stat?.bookingCount ?? 0,
        totalAmount: stat?.totalAmount ?? 0
      };
    });
    // Send the response
    return res.status(200).json({ success: true, data: maidWithStats });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
export const getAllUserForAdmin = async (req: Request, res: Response): Promise<any> => {
  try {

    const { type = "tillDate" } = req.query;

    const now = new Date();

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    let startDate: Date | null = null;

    // ===== DATE FILTER LOGIC =====
    switch (type) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;

      case "pastWeek":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;

      case "last1Month":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;

      case "last3Months":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        startDate.setHours(0, 0, 0, 0);
        break;

      case "last6Months":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 6);
        startDate.setHours(0, 0, 0, 0);
        break;

      case "last12Months":
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 12);
        startDate.setHours(0, 0, 0, 0);
        break;

      case "tillDate":
      default:
        startDate = null;
    }

    const dateFilter: any = startDate
      ? { createdAt: { $gte: startDate, $lte: endDate } }
      : {};

    // ===== USER QUERY WITH DATE FILTER =====
    const users = await User.find({
      role: "user",
      ...dateFilter,
      addresses: {
        $elemMatch: { serviceAvailable: true }
      }
    })
      .sort({ createdAt: -1 })
      .lean();
    // const users = await User.find({
    //   role: "user",
    //   ...dateFilter,
    //   addresses: {
    //     $not: { $elemMatch: { serviceAvailable: false } }
    //   }
    // })
    //   .sort({ createdAt: -1 })
    //   .lean();

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "Users Not Found" });
    }

    // ===== BOOKING STATS =====
    const bookingStats = await Booking.aggregate([
      {
        $group: {
          _id: "$user_id",
          bookingCount: { $sum: 1 },
          totalAmount: { $sum: "$total_amount" }
        }
      }
    ]);

    const statsMap = new Map(
      bookingStats.map(stat => [stat._id.toString(), stat])
    );

    const usersWithStats = users.map(user => {
      const stat = statsMap.get(user._id.toString());
      return {
        ...user,
        bookingCount: stat?.bookingCount ?? 0,
        totalAmount: stat?.totalAmount ?? 0
      };
    });

    return res.status(200).json({ success: true, data: usersWithStats });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
// Get User By Id For Admin
export const getUserByIdForAdmin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = (req as any).params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    //Fetch user by ID
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User Not Found" });
    }

    // Aggregate booking stats for this specific user
    const bookingStats = await Booking.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$user_id",
          bookingCount: { $sum: 1 },
          totalAmount: { $sum: "$total_amount" }
        }
      }
    ]);

    const stats = bookingStats[0] || { bookingCount: 0, totalAmount: 0 };

    // Merge stats with user object
    const userWithStats = {
      ...user,
      bookingCount: stats.bookingCount,
      totalAmount: stats.totalAmount
    };

    // Send the response
    return res.status(200).json({ success: true, data: userWithStats });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update user profile
export const updateUserByAdmin = async (req: Request, res: Response): Promise<any> => {
  const userId = req.params.userId;
  const data = req.body;
  try {
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No data to update' });
    }
    if (req.body.pincode) {
      const availablePincode = await Building.findOne({ isActive: true, pincode: req.body.pincode });
      if (availablePincode) {
        req.body.serviceAvailable = true;
      }
    }
    const updatedProfile = await User.findByIdAndUpdate(userId, req.body, { new: true });
    if (!updatedProfile) {
      return res.status(400).json({ success: false, message: "something went wrong" })
    }
    return res.json({ success: true, message: 'Profile updated', User: updatedProfile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
// Add address
export const addAddressByAdmin = async (req: Request, res: Response): Promise<any> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }
  const userId = req.params.userId;
  const { house, flat, city, state, pincode, wing_plot, building, street, latitude, longitude, hasPetOrCat, is_default } = req.body;
  // let serviceAvailable = false;
  const availablePincode = await Building.findOne({ isActive: true, pincode: pincode, name: building });
  if (!availablePincode) {
    res.status(400).json({ success: false, message: "Service is not available for this location" });
    return;
    // serviceAvailable = true;
  }
  try {
    if (is_default) {
      // Update other addresses to false
      await User.updateMany(
        { _id: userId, 'addresses.is_default': true }, { $set: { 'addresses.$[].is_default': false } })
    }

    const addressData = {
      house,
      flat: flat,
      city,
      wing_plot,
      state,
      pincode,
      building,
      street: street,
      hasPetOrCat,
      latitude: latitude,
      longitude: longitude,
      is_default: !!is_default
    };

    const user = await User.findByIdAndUpdate(userId, { $push: { addresses: addressData } }, { new: true });

    const newAddress = user?.addresses[user.addresses.length - 1];
    return res.status(201).json({ success: true, message: "Address Save Successful" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
// Get addresses
export const getAddressesByAdmin = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId).select('addresses');
    res.json({ success: true, data: user?.addresses || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
// Update address
export const updateAddressByAdmin = async (req: Request, res: Response): Promise<any> => {
  const userId = req.params.userId;
  const { addressId } = req.params;
  if (req.body.pincode) {
    // let serviceAvailable = false;
    const availablePincode = await Building.findOne({ isActive: true, pincode: req.body.pincode, name: req.body.building });
    if (!availablePincode) {
      res.status(400).json({ success: false, message: "Service is not available for this location" });
      return;
      // serviceAvailable = true;
    }
    if (availablePincode) {
      req.body.serviceAvailable = true;
    }
  }
  const data = req.body;
  try {
    // If new address is set as default → reset other defaults
    if (data.is_default) {
      await User.updateMany(
        { _id: userId, 'addresses.is_default': true },
        { $set: { 'addresses.$[].is_default': false } }
      );
    }
    // Build $set object dynamically
    const updateFields: any = {};
    for (const key in data) {
      updateFields[`addresses.$.${key}`] = data[key];
    }
    await User.updateOne({ _id: userId, 'addresses._id': addressId }, { $set: updateFields });
    return res.json({ success: true, message: 'Address updated' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
// Update address
export const updateSelectAddressByAdmin = async (req: Request, res: Response): Promise<any> => {
  const userId = req.params.userId;
  const { addressId } = req.params;

  try {
    // 1. Set all addresses to false
    await User.updateOne(
      { _id: userId },
      { $set: { "addresses.$[].is_default": false } }
    );

    // 2. Set selected address to true
    await User.updateOne(
      { _id: userId, "addresses._id": addressId },
      { $set: { "addresses.$.is_default": true } }
    );

    return res.json({ success: true, message: "Default address updated successfully" });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
// Delete address
export const deleteAddressByAdmin = async (req: Request, res: Response): Promise<any> => {
  const userId = req.params.userId;
  const { addressId } = req.params;
  try {
    await User.updateOne({ _id: userId }, { $pull: { addresses: { _id: addressId } } });
    return res.json({ success: true, message: 'Address deleted' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    const { remark } = req.body;
    const user = await User.findOneAndUpdate({ _id: userId }, { isActive: false, remark }, { new: true });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found or already deleted', });
      return;
    }
    res.status(200).json({ success: true, message: 'Account deleted successfully', });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', });
  }
};

// export const removePushToken = async (req: Request, res: Response) => {
//   try {
//     const { userId, token } = req.body;
//     if (!userId || !token) {
//       return res.status(400).json({ message: "UserId and Token are required" });
//     }
//     const result = await User.findByIdAndUpdate(
//       userId, {
//       $pull: { pushTokens: { token: token } }
//     }, { new: true });
//     if (!result) {
//       return res.status(404).json({ message: "User not found" });
//     }
//     res.status(200).json({ message: "Device removed successfully", remainingDevices: result.pushTokens.length });
//   } catch (error: any) {
//     res.status(500).json({ error: error.message });
//   }
// };


// Add Amount User Wallet
// Update user profile

export const walletAmountUpdate = async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  try {
    if (!req.body.wallet_balance) {
      return res.status(400).json({ success: false, message: 'Wallet Amount is Required' });
    }
    const user = await User.findById(id);
    if (!user) {
      return res.status(400).json({ success: false, message: "something went wrong" })
    }
    user.wallet_balance += req.body.wallet_balance;
    await user.save();
    return res.json({ success: true, message: 'amount added successfully', User: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// service availability check for address
export const NotServiceUser = async (req: Request, res: Response): Promise<void> => {
  try {
    // const users = await User.find({ addresses: { $elemMatch: { serviceAvailable: false } } });
    const users = await User.find({
      isActive: true, role: "user",
      addresses: {
        $not: { $elemMatch: { serviceAvailable: true } }
      }
    }).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, message: 'Users found where service is not available', data: users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
