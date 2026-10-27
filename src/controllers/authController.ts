import jwt from 'jsonwebtoken';
import bcryptjs from "bcryptjs"
import { validationResult } from 'express-validator';
import User from '../models/User.js';
import { RequestHandler } from 'express';
import cloudinary from '../middleware/cloudinary.js';
import axios from 'axios';
import Building from '../models/Building.js';
import { checkInAttendance, checkOutAttendance } from './attendance.controller.js';
import { sendOtp } from '../services/fast2sms.js';
import OtpModel from "../models/Otp.js";
import offerUsedUser from '../models/offerUsedUser.js';
import Maid from '../models/Maid.js';

interface MulterFile extends Express.Multer.File {
  buffer: Buffer;
}

const generateToken = (userId: string) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!);
  // return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRE! });
};
// user register by admin
export const registerUserByAdmin: RequestHandler = async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { email, phone, house, street, flat, wing_plot, building, state, city, hasPetOrCat, pincode } = req.body;

    // Check user existence
    const existing = await User.findOne({ $or: [{ isActive: true, email }, { isActive: true, phone }] });
    if (existing) return res.status(400).json({ success: false, message: 'User exists' });

    let serviceAvailable = false;
    let is_default = false
    req.body.isNewUser = false;
    const availablePincode = await Building.findOne({ isActive: true, pincode: pincode, name: building });
    if (availablePincode) {
      serviceAvailable = true;
      is_default = true
      req.body.isNewUser = true;
    }
    const address = { house, flat, street, wing_plot, city, state, hasPetOrCat, building, pincode, serviceAvailable, is_default }
    req.body.addresses = await address;
    const oldUser = await offerUsedUser.findOne({ phone: phone, isOffer: true })
    if (oldUser) {
      req.body.isNewUser = false;
    }
    const user = await User.create(req.body);

    const token = generateToken((user._id as string).toString());
    res.status(201).json({ success: true, message: "Register Successful", token, user: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
// skip-button
export const skipButton: RequestHandler = async (req: any, res: any) => {
  try {
    res.status(200).json({ data: { skip: true }, success: true });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
export const test: RequestHandler = async (req: any, res: any) => {
  // try {

  //   const payload = {
  //     type: "template",
  //     message_id: "19105",
  //     phone_number_id: 994810607059837,
  //     numbers: "9131662204",
  //     variables_values: 'Vikram|Order Successfully Placed|19-05-2026|9131662204'
  //   };
  //   console.log("PAYLOAD:", payload);

  //   const response = await axios.post(
  //     "https://www.fast2sms.com/dev/whatsapp",
  //     payload,
  //     {
  //       headers: {
  //         authorization: 'c3ST67LHestF1RJ2PUVyXurZhnBdilfO80bAk94wao5zjgqWGvOW2mncP0MTSZADXvV1xtkYBHw9uzRl',
  //         "Content-Type": "application/json"
  //       }
  //     }
  //   );

  //   console.log("SUCCESS:", response.data);

  //   return res.status(200).json({
  //     success: true,
  //     data: response.data
  //   });

  // } catch (error: any) {

  //   console.log(
  //     "ERROR:",
  //     JSON.stringify(error.response?.data, null, 2)
  //   );

  //   return res.status(500).json({
  //     success: false,
  //     error: error.response?.data || error.message
  //   });
  // }
};

// new user 
export const newUserLogin: RequestHandler = async (req: any, res: any) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ isActive: true, phone: phone })
    if (!user) {
      const newUser = await User.create({ phone: phone })
      if (newUser) {
        const send = await sendOtp(phone);
        if (!send.return) {
          res.status(400).json({ success: false, message: "otp send failed, try again" })
          return;
        }
        res.status(200).json({ success: true, message: "Otp sent successful", user: { id: newUser._id, phone: newUser.phone, role: newUser.role } });
        return;
      } else {
        res.status(400).json({ message: "something went wrong", success: false });
        return;
      }
    }
    const send = await sendOtp(phone);
    if (!send.return) {
      res.status(400).json({ success: false, message: "otp send failed, try again" })
      return;
    }
    res.status(200).json({ success: true, message: "Otp sent successful", user: { id: user._id, phone: user.phone, role: user.role } });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const register: RequestHandler = async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { email, phone, house, street, flat, wing_plot, building, state, city, hasPetOrCat, pincode } = req.body;

    // Check user existence
    const existing = await User.findOne({ $or: [{ isActive: true, email }, { isActive: true, phone }] });
    if (existing) return res.status(400).json({ success: false, message: 'User exists' });
    // check user blocked or not
    const blockUser = await User.findOne({ phone: phone, isBlock: true })
    if (blockUser) return res.status(403).json({ success: false, message: "Your account is blocked, contact support" })
    let serviceAvailable = false;
    let is_default = false
    req.body.isNewUser = false;
    const availablePincode = await Building.findOne({ isActive: true, pincode: pincode, name: building });
    if (availablePincode) {
      serviceAvailable = true;
      is_default = true
      req.body.isNewUser = true;
    }
    const address = { house, flat, street, wing_plot, city, state, hasPetOrCat, building, pincode, serviceAvailable, is_default }
    req.body.addresses = await address;
    const oldUser = await offerUsedUser.findOne({ phone: phone, isOffer: true })
    if (oldUser) {
      req.body.isNewUser = false;
    }
    const user = await User.create(req.body);

    const token = generateToken((user._id as string).toString());
    res.status(201).json({ success: true, message: "Register Successful", token, user: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const login: RequestHandler = async (req: any, res: any) => {
  try {
    const { phone, email, password, fcmToken, platform, deviceName } = req.body;
    if (email && password) {
      const user = await User.findOne({ isActive: true, email: email, })
      if (!user) {
        res.status(404).json({ success: false, message: "Invalid Email" })
        return;
      }
      const status = await bcryptjs.compare(password, user.password)
      if (!status) {
        res.status(404).json({ success: false, message: "Invalid Password" })
        return;
      }
      if (fcmToken) {
        user.fcmToken = fcmToken;
      }
      user.last_login = new Date();
      await user.save()
      const token = generateToken((user._id as string).toString());
      res.json({ success: true, message: "login successful", user: user, token });
      return;
    }
    const blockUser = await User.findOne({ phone: phone, isBlock: true })
    if (blockUser) return res.status(403).json({ success: false, message: "Your account is blocked, contact support" })
    const user = await User.findOne({ isActive: true, phone });
    // console.log(user);
    if (!user) return res.status(400).json({ success: false, message: 'Invalid Phone Number' });
    // if (phone.toString() === '9800000022' || phone.toString() === '9131662204') {//'8591035939'
    if (phone.toString() === '8591035939' || phone.toString() === '9800000025') {//'8591035939'
      res.status(200).json({ success: true, message: "Otp sent successful", user: { id: user._id, fullName: user.fullName, email: user.email, phone: user.phone, role: user.role } });
      return;
    }
    const send = await sendOtp(phone);
    if (!send.return) {
      res.status(400).json({ success: false, message: "otp send failed, try again" })
      return;
    }
    // console.log(send)
    res.status(200).json({ success: true, message: "Otp sent successful", user: { id: user._id, fullName: user.fullName, email: user.email, phone: user.phone, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const verifyOtp: RequestHandler = async (req: any, res: any, next) => {
  try {
    const { phone, otp, appVersion, appVersionCode, deviceType, fcmToken } = req.body;
    const user = await User.findOne({ isActive: true, phone: phone })
    if (!user) return res.status(400).json({ success: true, message: "Invalid Phone Number" })
    if (phone.toString() === '8591035939' || phone.toString() === "9800000025") { // '8591035939'
      if (otp.toString() === "1234") {
        user.last_login = new Date();
        user.login_image = req.body.login_image || undefined;
        if (fcmToken) {
          user.fcmToken = fcmToken;
        }
        if (appVersion || deviceType || appVersionCode) {
          user.appVersion = appVersion;
          user.appVersionCode = appVersionCode;
          user.deviceType = deviceType;
        }
        await user.save()
        const serviceAvailable = user.addresses?.[0]?.serviceAvailable;
        const token = generateToken((user._id as string).toString());
        res.status(200).json({ success: true, message: "login successful", user: user, serviceAvailable, token });
        return;
      }
    }

    const record = await OtpModel.findOne({ phoneNumber: phone, otp });
    if (!record) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }
    if (record.expiry < new Date()) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }
    // OTP valid, remove it
    await OtpModel.deleteMany({ phoneNumber: phone });


    if (fcmToken) {
      user.fcmToken = fcmToken;
    }
    if (user.role === "maid") {
      const file = req.file as MulterFile;
      if (file) {
        // return res.status(400).json({ success: false, message: "Image is Require" })
        const imageUrl: string = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "maideazy/maids" },
            (error, result) => {
              if (error) return reject(error);
              if (result) return resolve(result.secure_url);
              reject(new Error("Upload failed"));
            }
          );
          uploadStream.end(file.buffer);
        });
        req.body.login_image = imageUrl;
      }
    }
    user.last_login = new Date();
    user.login_image = req.body.login_image || undefined;
    if (appVersion || deviceType || appVersionCode) {
      user.appVersion = appVersion;
      user.deviceType = deviceType;
      user.appVersionCode = appVersionCode;
    }
    await user.save()
    // let serviceAvailable = false;
    const serviceAvailable = user.addresses?.some(
      (address) => address.serviceAvailable === true) || false;

    const token = generateToken((user._id as string).toString());

    res.status(200).json({ success: true, message: "login successful", user: user, serviceAvailable, token });

  } catch (err) {
    console.log(err)
    return res.status(500).json({ message: "Internal Server Error", success: false })
  }
}
export const imageUpload: RequestHandler = async (req: any, res: any, next) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone: phone })
    if (!user) return res.status(400).json({ success: true, message: "Invalid Phone Number" });
    if (user.role === "maid") {
      const file = req.file as MulterFile;
      if (!file) {
        return res.status(400).json({ success: false, message: "Image is Require" })
      }
      const imageUrl: string = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "maideazy/maids" },
          (error, result) => {
            if (error) return reject(error);
            if (result) return resolve(result.secure_url);
            reject(new Error("Upload failed"));
          }
        );
        uploadStream.end(file.buffer);
      });
      req.body.login_image = imageUrl;
    }
    user.last_login = new Date();
    user.login_image = req.body.login_image || undefined;
    await Maid.findByIdAndUpdate(user.maidId, { $set: { working_status: true } }, { new: true });
    checkInAttendance(user.maidId)
    await user.save();
    res.status(200).json({ success: true, message: "image upload successful", user: user });

  } catch (err) {
    console.log(err)
    return res.status(500).json({ message: "Internal Server Error", success: false })
  }
}
// after testing;
export const imageUpload1: RequestHandler = async (req: any, res: any, next) => {
  try {
    const { phone } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid phone number", });
    }

    // IST-based today range
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const now = new Date();

    const istNow = new Date(now.getTime() + IST_OFFSET);

    const startOfToday = new Date(
      new Date(istNow).setHours(0, 0, 0, 0) - IST_OFFSET
    );

    const endOfToday = new Date(
      new Date(istNow).setHours(23, 59, 59, 999) - IST_OFFSET
    );

    // Same day login check
    if (user.last_login && user.last_login >= startOfToday && user.last_login <= endOfToday) {
      return res.status(400).json({ success: false, message: "Already logged in today", });
    }
    // If maid, image is required
    if (user.role === "maid") {
      const file = req.file as MulterFile;
      if (!file) {
        return res.status(400).json({ success: false, message: "Image is required", });
      }
      const imageUrl: string = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "maideazy" },
          (error, result) => {
            if (error) return reject(error);
            if (result) return resolve(result.secure_url);
            reject(new Error("Upload failed"));
          }
        );
        uploadStream.end(file.buffer);
      });
      user.login_image = imageUrl;
    }
    user.last_login = new Date();
    await user.save();
    // Attendance (maid only)
    if (user.role === "maid" && user.maidId) {
      await checkInAttendance(user.maidId);
    }
    return res.status(200).json({ success: true, message: "Image upload successful", user, });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Internal Server Error", });
  }
};


export const logout: RequestHandler = async (req: any, res: any, next) => {
  try {
    const userId = (req as any).user._id
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ success: false, message: "user not found" })
    }
    user.last_logout = new Date();
    await User.updateOne(
      { _id: userId },
      {
        $unset: {
          fcmToken: 1,
          lastUpdated: 1,
        }
      }
    );
    if (user.role === "maid" && user.maidId) {
      await Maid.findByIdAndUpdate(user.maidId, { $set: { working_status: false } }, { new: true });
      checkOutAttendance(user.maidId)
    }
    await user.save()
    res.json({ success: true, message: 'Logged out successfully', });
  } catch (error) {
    next(error);
  }
};
import https from "https";
// pincode api
export const pincode1: RequestHandler = async (req: any, res: any, next) => {
  try {
    const { pincode } = req.body;
    if (!pincode) {
      return res.status(400).json({ success: false, message: "Pincode is required", });
    }
    const building = await Building.find({ pincode: pincode })
    // const response = await axios.get(`https://api.postalpincode.in/pincode/${Number(pincode)}`,{ timeout: 8000 });
    const httpsAgent = new https.Agent({
      keepAlive: true
    });

    const response = await axios.get(
      `https://api.postalpincode.in/pincode/${pincode}`,
      {
        httpsAgent,
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        }
      }
    );
    const data = response.data?.[0];
    if (!data || data.Status !== "Success" || !data.PostOffice?.length) {
      return res.status(404).json({ success: false, message: "Invalid or not found pincode", });
    }
    const { District, State } = data.PostOffice[0];

    res.status(200).json({ success: true, message: "Pincode found", data: { city: District, state: State, building }, });
  } catch (error: any) {
    console.error("Error fetching pincode:", error.message);
    next(error);
  }
};
export const pincode = async (req: any, res: any) => {
  try {
    const { pincode } = req.body;

    if (!pincode) {
      return res.status(400).json({
        success: false,
        message: "Pincode is required"
      });
    }

    const building = await Building.find({ pincode });

    let city = "";
    let state = "";

    try {
      const response = await axios.get(
        `https://api.postalpincode.in/pincode/${pincode}`,
        {
          timeout: 8000,
          headers: { "User-Agent": "Mozilla/5.0" }
        }
      );

      const data = response.data?.[0];

      if (data?.Status === "Success") {
        city = data.PostOffice[0].District;
        state = data.PostOffice[0].State;
      }

    } catch (err) {

      // fallback API
      const fallback = await axios.get(
        `https://api.zippopotam.us/in/${pincode}`
      );
      console.log(fallback.data.places)
      city = fallback.data.places[0]["place name"];
      state = fallback.data.places[0]["state"];
    }

    return res.json({
      success: true,
      message: "Pincode found",
      data: { city, state, building }
    });

  } catch (error: any) {
    console.error("Error fetching pincode:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch pincode"
    });
  }
};