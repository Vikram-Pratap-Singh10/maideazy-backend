import mongoose, { Schema, Document } from "mongoose";

export interface ITimeSlotDateOverride extends Document {
    date: Date;
    pincode?: string;
    timeSlotId: mongoose.Types.ObjectId;
    timeSlot: string;
    closeAllSlots: boolean;
    isActive: boolean;
}

const timeSlotDateOverrideSchema = new Schema<ITimeSlotDateOverride>({
    date: {
        type: Date,
        // required: true,
        // index: true
    },
    pincode: {
        type: String,
    },
    timeSlotId: {
        type: Schema.Types.ObjectId,
        ref: "TimeSlot",
        // required: true
    },
    timeSlot: {
        type: String,
        // required: true
    },
    closeAllSlots: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    }
},
    { timestamps: true }
);

export default mongoose.model<ITimeSlotDateOverride>("TimeSlotDateOverride", timeSlotDateOverrideSchema);