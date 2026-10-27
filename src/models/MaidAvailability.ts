import mongoose, { Document, Schema } from 'mongoose';

export interface IMaidAvailability extends Document {
  maid_id: mongoose.Types.ObjectId;
  available_date: Date;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  status: boolean;
}

const maidAvailabilitySchema: Schema = new Schema({
  maid_id: {
    type: Schema.Types.ObjectId,
    ref: 'Maid',
    required: true
  },
  available_date: {
    type: Date,
    required: true
  },
  start_time: {
    type: String,
    required: true,
  },
  end_time: {
    type: String,
    required: true,
  },
  is_booked: {
    type: Boolean,
    default: false
  },
  status: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'maid_availability'
});

export default mongoose.model<IMaidAvailability>('MaidAvailability', maidAvailabilitySchema);
