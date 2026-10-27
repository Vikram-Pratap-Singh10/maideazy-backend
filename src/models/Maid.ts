import mongoose, { Document, Schema } from 'mongoose';

export interface IMaid extends Document {
  name: string;
  email: string;
  phone: string;
  address: string;
  hub: string;
  age: number;
  work_type: string;
  languages: string;
  skill: string;
  marital_status: string;
  experience_years: number;
  hourly_rate: number;
  rating: number;
  total_reviews: number;
  profile_image?: string;
  bio?: string;
  is_active: boolean;
  working_status: boolean;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  reportedCount: number;
  hasProblemPetOrCat: boolean;
  is_online: boolean;
}

const maidSchema: Schema = new Schema({
  name: {
    type: String,
    maxlength: 100
  },
  email: {
    type: String,
    lowercase: true,
  },
  phone: {
    type: String,
    maxlength: 15
  },
  address: {
    type: String
  },
  hub: {
    type: String
  },
  age: {
    type: Number
  },
  work_type: {
    type: String
  },
  languages: {
    type: String
  },
  skill: {
    type: String
  },
  marital_status: {
    type: String
  },
  experience_years: {
    type: Number,
    default: 0,
    min: 0
  },
  hourly_rate: {
    type: Number,
    min: 0
  },
  rating: {
    type: Number,
    default: 0.00,
    min: 0,
    max: 5
  },
  total_reviews: {
    type: Number,
    default: 0,
    min: 0
  },
  profile_image: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    default: null
  },
  is_active: {
    type: Boolean,
    default: true
  },
  working_status: {
    type: Boolean,
    default: false
  },
  start_time: {
    type: String,
  },
  end_time: {
    type: String,
  },
  is_booked: {
    type: Boolean,
    default: false
  },
  reportedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  hasProblemPetOrCat: {
    type: Boolean,
    default: false
  },
  is_online: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'maids'
});

export default mongoose.model<IMaid>('Maid', maidSchema);
