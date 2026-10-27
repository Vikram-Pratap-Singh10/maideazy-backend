import mongoose, { Schema, Document } from "mongoose";

export interface IArrivalConfig extends Document {
  season: "summer" | "winter" | "rainy" | "default";
  arrivalTime: number;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ArrivalConfigSchema = new Schema<IArrivalConfig>({
  season: {
    type: String,
    enum: ["summer", "winter", "rainy", "default"],
    required: true,
  },
  arrivalTime: {
    type: Number,
    required: true
  },
  effectiveFrom: {
    type: Date
  },
  effectiveTo: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

export default mongoose.model<IArrivalConfig>("ArrivalConfig", ArrivalConfigSchema);
