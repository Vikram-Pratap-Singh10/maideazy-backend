import mongoose, { Document, Schema } from 'mongoose';

export interface IAddress {
  _id?: string;
  type?: string;
  house?: string;
  street?: string;
  city?: string;
  state?: string;
  pincode: string;
  flat?: string;
  wing_plot: string;
  building: string;
  serviceAvailable: boolean;
  hasPetOrCat: boolean;
  latitude?: number;
  longitude?: number;
  is_default: boolean;
}

export interface IPushToken {
  fcmToken: string;
  platform: 'web' | 'ios' | 'android';
  deviceName?: string;
  lastUpdated: Date;
}

export interface IUser extends Document {
  fullName: string;
  email: string;
  phone: string;
  profile_image?: string;
  role: 'user' | 'maid' | 'admin';
  last_login?: Date;
  wallet_balance: number;
  pin?: number
  login_otp?: number;
  login_otp_expire?: Date;
  addresses: IAddress[];
  maidId: string;
  login_image: string;
  logout_image: string;
  last_logout?: Date;
  password: string
  hasPetOrCat: boolean;
  isFreeBooking: boolean;
  isNewUser: boolean;
  registerDate: Date;
  offerBookingCount?: number;
  bookingCount?: number;
  appVersion: string;
  appVersionCode: string;
  deviceType: string;
  fcmToken: string;
  isNotification: boolean
  isNewOffer: boolean
  isBlock: boolean
  maid_address: string;
  pushTokens: IPushToken[];
  freeOffer: {
    offerName?: string;
    freeBookings?: number;
    bookingsLimit?: number;
    validityDays?: Date;
    perBookingDuration?: number;
    lastBooking?: Date;
  };
  isActive: boolean;
}

const addressSchema = new Schema<IAddress>({
  type: {
    type: String,
    default: "home"
  },
  house: {
    type: String,
    required: true
  },
  street: {
    type: String,
  },
  city: {
    type: String,
    // required: true,
    maxlength: 100
  },
  state: {
    type: String,
    maxlength: 100
  },
  pincode: {
    type: String,
    // required: true,
    maxlength: 10
  },
  flat: {
    type: String,
  },
  wing_plot: {
    type: String,
  },
  building: {
    type: String,
  },
  serviceAvailable: {
    type: Boolean,
    default: true
  },
  hasPetOrCat: {
    type: Boolean,
    default: false
  },
  latitude: {
    type: Number,
    min: -90,
    max: 90,
    default: null
  },
  longitude: {
    type: Number,
    min: -180,
    max: 180,
    default: null
  },
  is_default: {
    type: Boolean,
    default: false
  }
}, {
  _id: true,
  timestamps: true
});

const pushTokenSchema = new Schema<IPushToken>({
  fcmToken: { type: String },
  platform: {
    type: String,
    enum: ['web', 'ios', 'android'],
    required: true
  },
  deviceName: { type: String },
  lastUpdated: { type: Date, default: Date.now }
});


const userSchema: Schema = new Schema({
  fullName: {
    type: String,
    maxlength: 100
  },
  email: {
    type: String,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
    maxlength: 15
  },
  profile_image: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'maid', 'admin'],
    default: 'user'
  },
  last_login: {
    type: Date
  },
  login_otp: {
    type: Number
  },
  login_otp_expire: {
    type: Date
  },
  wallet_balance: {
    type: Number,
    default: 0
  },
  pin: {
    type: Number
  },
  maidId: {
    type: String
  },
  login_image: {
    type: String
  },
  password: {
    type: String
  },
  hasPetOrCat: {
    type: Boolean,
    default: false
  },
  isFreeBooking: {
    type: Boolean,
    default: false
  },
  isNewUser: {
    type: Boolean,
    default: true
  },
  registerDate: {
    type: Date,
    default: Date.now
  },
  offerBookingCount: {
    type: Number,
    default: 0
  },
  bookingCount: {
    type: Number,
    default: 0
  },
  appVersion: {
    type: String
  },
  appVersionCode: {
    type: String
  },
  deviceType: {
    type: String
  },
  fcmToken: {
    type: String
  },
  isNotification: {
    type: Boolean,
    default: false
  },
  pushTokens: [pushTokenSchema],
  addresses: [addressSchema],
  freeOffer: {
    offerName: String,
    freeBookings: Number,
    bookingsLimit: Number,
    validityDays: Date,
    perBookingDuration: Number,
    lastBooking: Date
  },
  maid_address: {
    type: String
  },
  isNewOffer: {
    type: Boolean
  },
  isBlock: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true, collection: 'users' });

export default mongoose.model<IUser>('User', userSchema);
