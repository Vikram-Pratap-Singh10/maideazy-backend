import mongoose, { Schema, Document } from "mongoose";

export interface IAttendance extends Document {
    maid_id: mongoose.Types.ObjectId;
    date: Date;
    check_in_time?: Date;
    check_out_time?: Date;
    total_hours?: number;
    image: string;
    status: 'early' | 'on-time' | 'late' | 'absent';
}

const AttendanceSchema = new Schema<IAttendance>({
    maid_id: {
        type: Schema.Types.ObjectId,
        ref: "Maid",
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    check_in_time: {
        type: Date,
    },
    check_out_time: {
        type: Date,
    },
    total_hours: {
        type: Number,
        default: 0,
    },
    image:{
        type: String
    },
    status: {
        type: String,
        enum: ["early", "on-time", "late", "absent"],
        default: "absent",
    },
}, { timestamps: true });


export default mongoose.model<IAttendance>("Attendance", AttendanceSchema);
