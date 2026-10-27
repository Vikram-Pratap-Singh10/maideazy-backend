import mongoose, { Schema, Document } from "mongoose";

export interface ISettings extends Document {
    name: string;
    email?: string;
    fbLink?: string;
    igLink?: string;
    mobile?: string;
    whatsappNumber?: string;
    location?: {
        address?: string;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
        coordinates?: { lat: number; lng: number } | null;
        [key: string]: any;
    };
    updatedAt?: Date;
    createdAt?: Date;
    isNewOffer: boolean;
    is_active: boolean;
    servicePricePerMinute: number;
    demoServicePricePerMinute: number;
    bookingPerSlot: number;
    bookingPerUserSlot: number;
    start_time: string;
    end_time: string;
    gstPercentage: number;
    isCOD: boolean;
}

const locationSchema = new Schema({
    address: {
        type: String,
        trim: true
    },
    city: {
        type: String,
        trim: true
    },
    state: {
        type: String,
        trim: true
    },
    country: {
        type: String,
        trim: true
    },
    postalCode: {
        type: String,
        trim: true
    },
    coordinates: {
        lat: { type: Number },
        lng: { type: Number },
    },
},
    { _id: false }
);

const settingsSchema = new Schema<ISettings>({
    name: {
        type: String
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
    },
    mobile: {
        type: String,
        trim: true,
    },
    fbLink: {
        type: String,
    },
    igLink: {
        type: String,
    },
    whatsappNumber: {
        type: String,
        trim: true,
    },
    isNewOffer: {
        type: Boolean,
        default: true
    },
    is_active: {
        type: Boolean,
        default: true
    },
    location: {
        type: locationSchema,
        default: {},
    },
    servicePricePerMinute: {
        type: Number
    },
    demoServicePricePerMinute: {
        type: Number
    },
    bookingPerSlot: {
        type: Number,
        default: 0
    },
    bookingPerUserSlot: {
        type: Number,
        default: 2
    },
    gstPercentage: {
        type: Number,
        default: 0
    },
    start_time: {
        type: String,
        required: true,
    },
    end_time: {
        type: String,
        required: true,
    },
    isCOD:{
        type:Boolean,
        default:false
    }
}, { timestamps: true });

export default mongoose.model<ISettings>("Settings", settingsSchema);
