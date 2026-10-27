import mongoose, { Document, Schema } from 'mongoose'

export interface IFAavorite extends Document {
  user_id: mongoose.Types.ObjectId
  maid_id: mongoose.Types.ObjectId
  created_at: Date
}

const FavoriteSchema: Schema = new Schema({
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
  created_at: {
    type: Date,
    default: Date.now
  }
})

// Compound index to prevent duplicate entries
FavoriteSchema.index({ user_id: 1, maid_id: 1 }, { unique: true })

export default mongoose.model<IFAavorite>('Wishlist', FavoriteSchema)