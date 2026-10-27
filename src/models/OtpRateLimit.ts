import mongoose, { Schema, Document } from "mongoose";

export interface IOtpRateLimit extends Document {
  phoneNumber: string;
  count: number;
  lastRequest: Date;
}

const OtpRateLimitSchema = new Schema<IOtpRateLimit>(
  {
    phoneNumber: { type: String, required: true, index: true },
    count: { type: Number, default: 0 },
    lastRequest: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model<IOtpRateLimit>("OtpRateLimit", OtpRateLimitSchema);
