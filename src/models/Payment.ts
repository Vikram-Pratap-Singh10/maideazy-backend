import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  booking_id?: mongoose.Types.ObjectId;
  booking_ids?: mongoose.Types.ObjectId[]
  user_id: mongoose.Types.ObjectId;
  amount: number;
  payment_method: string;
  transaction_id: string;
  order_id: string;
  payment_gateway: string;
  payment_status: 'pending' | 'success' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  payment_date: Date;
  remark: string;
  wallet?: number;
  isBooking?: string;
  extend_time: number;
  type?: string;
  payment_order?: any[];
}

const paymentSchema: Schema = new Schema({
  booking_id: {
    type: Schema.Types.ObjectId,
    ref: 'Booking'
  },
  booking_ids: [{
    type: Schema.Types.ObjectId,
    ref: 'Booking',
  }],
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  payment_method: {
    type: String,
    // required: true,
    maxlength: 50
  },
  transaction_id: {
    type: String,
  },
  order_id: {
    type: String,
  },
  payment_gateway: {
    type: String,
    // required: true,
    maxlength: 50
  },
  payment_status: {
    type: String,
    enum: ['pending', 'unpaid', 'success', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  payment_date: {
    type: Date,
    default: Date.now
  },
  remark: {
    type: String
  },
  wallet: {
    type: Number,
    default: 0
  },
  payment_order: {
    type: [Object],
    default: []
  },
  isBooking: {
    type: String
  },
  extend_time: {
    type: Number,
    default: 0
  },
  type: {
    type: String,
  }
}, {
  timestamps: true,
  collection: 'payments'
});

export default mongoose.model<IPayment>('Payment', paymentSchema);
