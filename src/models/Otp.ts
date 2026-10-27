import mongoose, { Schema, Document } from "mongoose";

export interface IOtp extends Document {
  phoneNumber: string;
  otp: string;
  expiry: Date;
  createdAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    phoneNumber: { type: String, required: true, index: true },
    otp: { type: String, required: true },
    expiry: { type: Date, required: true },
  },
  { timestamps: true }
);

// Auto-delete expired OTPs
OtpSchema.index({ expiry: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IOtp>("Otp", OtpSchema);
