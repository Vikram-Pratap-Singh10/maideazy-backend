import mongoose, { Document, Schema } from 'mongoose';

export interface IBooking extends Document {
  user_id: mongoose.Types.ObjectId;
  maid_id?: mongoose.Types.ObjectId;
  service_id: mongoose.Types.ObjectId;
  address_id: {
    type?: string;
    house?: string;
    wing_plot?: string;
    street?: string;
    city: string;
    state: string;
    pincode: string;
    flat?: string;
    building: string;
    latitude?: number;
    longitude?: number;
  };
  type?: string;
  bookingType: string;
  booking_dates: string[];
  booking_date: Date;
  booking_complete_date: Date;
  start_time: string;
  end_time?: string;
  extend_time: number;
  total_extend_time: number;
  duration_hours: number;
  payment_details: {
    service_charge: number;
    wallet_amount: number;
    taxes: number;
    total_amount: number;
  };
  payble_amount: number;
  total_amount: number;
  payment_status: string;
  status: 'pending' | 'confirmed' | 'ongoing' | 'completed' | 'cancelled' | 'failed' | 'success';
  booking_reference: string;
  pin?: string;
  pinVerify?: string;
  actual_start_time?: Date;
  timer_end_time?: Date;
  isFreeBooking: boolean;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paymentType?: string;
  remark?: string;
  paymentDate?: Date;
  isMaidRing: boolean;
  isUserRing: boolean;
  cancelled_at?: Date
}

const bookingSchema = new Schema<IBooking>({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  maid_id: {
    type: Schema.Types.ObjectId,
    ref: 'Maid',
  },
  service_id: {
    type: Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
  },
  address_id: {
    type: { type: String },
    house: { type: String },
    wing_plot: { type: String },
    street: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    flat: { type: String },
    building: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  type: {
    type: String,
    default: 'single'
  },
  bookingType: {
    type: String,
    default: 'new'
  },
  booking_dates: [{
    type: String,
  }],
  booking_date: {
    type: Date,
  },
  start_time: {
    type: String,
    set: (value: string) => value.replace(/\s+/g, ''),
  },
  end_time: {
    type: String,
    set: (value: string) => value.replace(/\s+/g, ''),
  },
  extend_time: {
    type: Number,
    default: 0,
  },
  total_extend_time: {
    type: Number,
    default: 0,
  },
  duration_hours: {
    type: Number,
  },
  payment_details: {
    service_charge: { type: Number },
    wallet_amount: { type: Number },
    taxes: { type: Number },
    total_amount: { type: Number, required: true, min: 0 },
  },
  payble_amount: {
    type: Number
  },
  total_amount: {
    type: Number
  },
  payment_status: {
    type: String,
    // enum: ['unpaid', 'paid_via_wallet', 'paid_online', 'partially_paid'],
    default: 'unpaid',
  },
  isFreeBooking: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'assigned', 'ongoing', 'completed', 'cancelled', 'failed', 'success'],
    default: 'failed',
  },
  booking_reference: {
    type: String,
    maxlength: 50,
  },
  pin: {
    type: String,
  },
  pinVerify: {
    type: String,
  },
  actual_start_time: {
    type: Date,
  },
  timer_end_time: {
    type: Date,
  },
  booking_complete_date: {
    type: Date,
  },
  razorpayOrderId: {
    type: String
  },
  razorpayPaymentId: {
    type: String
  },
  paymentDate: {
    type: Date
  },
  paymentType: {
    type: String
  },
  remark: {
    type: String
  },
  isMaidRing: {
    type: Boolean,
    default: true
  },
  isUserRing: {
    type: Boolean,
    default: true
  },
  cancelled_at: {
    type: Date
  }
}, { timestamps: true, });

export default mongoose.model<IBooking>('Booking', bookingSchema);
