import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  booking_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  maid_id: mongoose.Types.ObjectId;
  rating: number;
  review_message?: string;
  is_anonymous: boolean;
}

const reviewSchema: Schema = new Schema({
  booking_id: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  maid_id: {
    type: Schema.Types.ObjectId,
    ref: 'Maid',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  review_message: {
    type: String,
    default: null
  },
  is_anonymous: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'reviews'
});

export default mongoose.model<IReview>('Review', reviewSchema);
