import { Schema, model, type Types } from 'mongoose';

export interface ISection {
  _id: Types.ObjectId;
  name: string;
  description: string;
  isArchived: boolean;
  isDeleted: boolean;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const sectionSchema = new Schema<ISection>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const SectionModel = model<ISection>('Section', sectionSchema);
