import mongoose, { Schema, Document } from "mongoose";

export interface ITimeSlot extends Document {
    label: string;
    times: string[];
    time: [
        {
            timeSlot: string,
            isActive: boolean
        }
    ];
    isActive: boolean;
}

const timeSlotSchema = new Schema<ITimeSlot>(
    {
        label: {
            type: String,
            enum: ["Morning", "Afternoon", "Evening"],
            required: true
        },
        times: [
            {
                type: String,
                required: true
            }
        ],
        time: [{
            timeSlot: {
                type: String,
                required: true
            },
            isActive: {
                type: Boolean,
                default: true
            }
        }],
        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

export default mongoose.model<ITimeSlot>("TimeSlot", timeSlotSchema);
