import { Schema, model, type Types } from 'mongoose';

export interface ICategory {
  _id: Types.ObjectId;
  name: string;
  description: string;
  color: string;
  isArchived: boolean;
  isDeleted: boolean;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, default: '', trim: true },
    color: { type: String, default: '#475569', trim: true },
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

categorySchema.index({ isDeleted: 1, isArchived: 1, name: 1 });

export const CategoryModel = model<ICategory>('Category', categorySchema);
