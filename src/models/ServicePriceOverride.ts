import mongoose, { Schema, Document } from "mongoose";

export interface IServicePriceOverride extends Document {
    date?: Date;
    servicePricePerMinute: number;
    demoServicePricePerMinute: number;
    pincode?: string;
    is_active: boolean;
}

const servicePriceOverrideSchema = new Schema<IServicePriceOverride>({
    date: {
        type: Date,
        // required: true,
        // index: true
    },
    pincode: {
        type: String,
    },
    servicePricePerMinute: {
        type: Number
    },
    demoServicePricePerMinute: {
        type: Number
    },
    is_active: {
        type: Boolean,
        default: true
    }
},
    { timestamps: true }
);

export default mongoose.model<IServicePriceOverride>("ServicePriceOverride", servicePriceOverrideSchema);