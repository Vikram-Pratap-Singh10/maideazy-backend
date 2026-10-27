import mongoose, { Document, Schema } from "mongoose";

export interface IOfferUsedOffer extends Document {
    name?: string;
    phone: string
    isOffer: boolean;
    status: boolean;
}

const OfferUsedUserSchema = new Schema<IOfferUsedOffer>({
    name: {
        type: String
    },
    phone: {
        type: String,
        unique: true
    },
    isOffer: {
        type: Boolean,
        default: true
    },
    status:{
        type:Boolean,
        default:true
    }
}, { timestamps: true })

export default mongoose.model<IOfferUsedOffer>('OfferUsedUser',OfferUsedUserSchema)