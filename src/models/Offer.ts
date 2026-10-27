import mongoose, { Schema, Document } from "mongoose";


export interface IOffer extends Document {
  title: string;
  description?: string;
  type: string;
  serviceId?: mongoose.Types.ObjectId;
  discountPercent?: number;
  flatPrice?: number;
  conditions?: {
    bookingsLimit?: number;
    validityDays?: number;
    perBookingDuration?: number;
  };
  expiryTime?: Date;
  offerType:string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OfferSchema = new Schema<IOffer>({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  type: {
    type: String,
  },
  serviceId: {
    type: Schema.Types.ObjectId,
    ref: "Service"
  },
  discountPercent: {
    type: Number
  },
  flatPrice: {
    type: Number
  },
  conditions: {
    bookingsLimit: Number,
    validityDays: Number,
    perBookingDuration: Number,
  },
  expiryTime: {
    type: Date
  },
  offerType:{
    type:String,
    default:"all"
  },
  isActive: {
    type: Boolean,
    default: true
  },
}, { timestamps: true });

export default mongoose.model<IOffer>("Offer", OfferSchema);
