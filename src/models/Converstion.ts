import mongoose, { Document, Schema } from "mongoose";

export interface IConversation extends Document {
    members: mongoose.Types.ObjectId[];
    messages: mongoose.Types.ObjectId[];
    timestamp: Date;
}

const ConversationSchema: Schema = new Schema({
    members: [{
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    }],
    messages: [{
        type: Schema.Types.ObjectId,
        ref: "Message"
    }],
    timestamp: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model<IConversation>("Conversation", ConversationSchema);