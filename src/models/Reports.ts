import mongoose, { Document, Schema } from 'mongoose';

export interface IReport extends Document {
    user_id: mongoose.Types.ObjectId;
    maid_id: mongoose.Types.ObjectId;
    reason: string;
    details?: string;
    status: 'pending' | 'reviewed' | 'action_taken';
    createdAt: Date;
    updatedAt: Date;
}

const reportSchema = new Schema<IReport>({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    maid_id: {
        type: Schema.Types.ObjectId,
        ref: 'Maid',
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    details: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'action_taken'],
        default: 'pending',
    },
}, { timestamps: true });

// Index for report queries
reportSchema.index({ reportedUser: 1 });
reportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IReport>('Report', reportSchema);