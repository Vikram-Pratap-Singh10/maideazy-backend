import mongoose, { Document, Schema } from 'mongoose';

export interface IService extends Document {
  type: string;
  service_name: string;
  description?: string;
  duration?: number;
  discountAmount: number;
  originalPrice: number;
  total_amount: number;
  is_active: boolean;
}

const serviceSchema: Schema = new Schema({
  type:{
    type: String,
  },
  service_name: {
    type: String,
    required: true,
    maxlength: 100
  },
  description: {
    type: String,
    default: null
  },
  duration: {
    type: Number
  },
  discountAmount: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  total_amount: {
    type: Number,
    min: 0
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'services'
});

export default mongoose.model<IService>('Service', serviceSchema);
