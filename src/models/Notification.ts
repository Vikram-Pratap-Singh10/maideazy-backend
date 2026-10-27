import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
    recipient: mongoose.Types.ObjectId;
    sender?: mongoose.Types.ObjectId;
    maid_id?: mongoose.Types.ObjectId;
    type: string;
    role: string;
    message: string;
    entityId?: mongoose.Types.ObjectId;
    isRead: boolean;
    createdAt: Date;
}

const notificationSchema = new Schema<INotification>({
    recipient: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    maid_id: {
        type: Schema.Types.ObjectId,
        ref: 'Maid'
    },
    type: {
        type: String,
        required: true,
        enum: [
            'maid_assigned',
            'new_booking',
            'new_bookings',
            'new_message',
            'maid_accepted',
            'booking_assigned',
            'booking_start',
            "booking_auto_cancelled",
            "booking_user_cancelled",
            "booking_user_rescheduled"
        ],
    },
    message: {
        type: String,
        required: true
    },
    role: {
        type: String
    },
    entityId: {
        type: Schema.Types.ObjectId
    },
    isRead: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });


export default mongoose.model<INotification>('Notification', notificationSchema);