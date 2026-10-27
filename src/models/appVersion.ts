import mongoose, { Schema, Document } from "mongoose";

export interface IAppVersion extends Document {
    androidVersionCode?: string;
    androidVersion?: string;
    iosVersionCode?: string;
    iosVersion?: string;
    forceUpdate?: boolean;
    androidLink: string;
    iosLink: string;
    visible: boolean;
}

const appVersionSchema = new Schema<IAppVersion>({
    androidVersionCode: {
        type: String
    },
    androidVersion: {
        type: String
    },
    iosVersionCode: {
        type: String
    },
    iosVersion: {
        type: String
    },
    forceUpdate: {
        type: Boolean,
        default: false
    },
    androidLink: {
        type: String,
        required: true
    },
    iosLink: {
        type: String,
        required: true
    },
    visible: {
        type: Boolean,
        required: true
    }
}, { timestamps: true });

export default mongoose.model<IAppVersion>("AppVersion", appVersionSchema);
