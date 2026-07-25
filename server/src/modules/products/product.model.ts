import { Schema, model, type Types } from 'mongoose';

export interface IProduct {
  _id: Types.ObjectId;
  name: string;
  code: string;
  category: string;
  dosageForm: string;
  strength: string;
  storageConditions: string;
  description: string;
  isArchived: boolean;
  isDeleted: boolean;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    category: { type: String, default: '', trim: true },
    dosageForm: { type: String, default: '', trim: true },
    strength: { type: String, default: '', trim: true },
    storageConditions: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

productSchema.index({ isDeleted: 1, isArchived: 1, name: 1 });

export const ProductModel = model<IProduct>('Product', productSchema);
