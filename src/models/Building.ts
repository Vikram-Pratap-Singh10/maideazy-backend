import mongoose, { Schema, Document } from "mongoose";

interface IBuilding extends Document {
    name: string;
    hub: string;
    pincode?: string;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const buildingSchema = new Schema<IBuilding>({
    name:{
        type:String
    },
    hub:{
        type:String
    },
    pincode:{
        type:String
    },
    isActive:{
        type:Boolean,
        default:true
    }
},{timestamps:true})

export default mongoose.model<IBuilding>("building",buildingSchema);