import mongoose, { Document, Schema } from "mongoose";

export interface IMessage extends Document {
    userId: mongoose.Types.ObjectId;
    message: string;
    timestamp: Date;
}

const MessageSchema: Schema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    message: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
})

export default mongoose.model<IMessage>("Message",MessageSchema)