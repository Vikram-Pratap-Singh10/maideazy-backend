import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || `mongodb://${process.env.DB_HOST}:${process.env.DB_PORT || 27017}/${process.env.DB_NAME}`);

    console.log(`MongoDB Connected`);
  } catch (error) {
    console.error('MongoDB connection error:', (error as Error).message);
    process.exit(1);
  }
};

export default connectDB;
