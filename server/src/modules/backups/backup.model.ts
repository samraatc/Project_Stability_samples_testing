import { Schema, model, type Types } from 'mongoose';

export interface IBackup {
  _id: Types.ObjectId;
  name: string;
  sizeBytes: number;
  collections: { name: string; count: number }[];
  createdBy: Types.ObjectId | null;
  createdAt: Date;
}

const backupSchema = new Schema<IBackup>(
  {
    name: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    collections: [
      {
        _id: false,
        name: { type: String, required: true },
        count: { type: Number, required: true },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

backupSchema.index({ createdAt: -1 });

export const BackupModel = model<IBackup>('Backup', backupSchema);
