import mongoose, { Schema, Document } from "mongoose";

export interface IBanner extends Document {
    title: string;
    subtitle?: string;
    description?: string;
    image: string;
    redirectUrl?: string;
    startDate?: Date;
    endDate?: Date;
    isActive: boolean;
    position?: number;
    bannerType?: string
    createdAt?: Date;
    updatedAt?: Date;
}

const bannerSchema = new Schema<IBanner>({
    title: {
        type: String,
        required: true,
        trim: true
    },
    subtitle: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    image: {
        type: String,
    },
    redirectUrl: {
        type: String,
        trim: true
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    },
    position: {
        type: Number,
        default: 0
    },
    bannerType: {
        type: String,
        default: "homepage",
    }
},
    { timestamps: true }
);

export default mongoose.model<IBanner>("Banner", bannerSchema);
