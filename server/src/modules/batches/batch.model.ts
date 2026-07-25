import { Schema, model, type Types } from 'mongoose';

export interface IBatch {
  _id: Types.ObjectId;
  batchNo: string;
  batchCode: string;
  product: Types.ObjectId;
  manufacturingDate: Date;
  notes: string;
  isArchived: boolean;
  isDeleted: boolean;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const batchSchema = new Schema<IBatch>(
  {
    batchNo: { type: String, default: '', trim: true },
    batchCode: { type: String, required: true, trim: true, uppercase: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    manufacturingDate: { type: Date, required: true },
    notes: { type: String, default: '' },
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// Duplicate validation: a batch code is unique within its product.
batchSchema.index({ product: 1, batchCode: 1 }, { unique: true });

export const BatchModel = model<IBatch>('Batch', batchSchema);
