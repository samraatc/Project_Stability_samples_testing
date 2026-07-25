import { Schema, model, type Types } from 'mongoose';
import { STABILITY_TYPES, type StabilityType } from '../../constants/permissions';

export type SampleStatus = 'registered' | 'running' | 'completed';

export interface IIntervalTest {
  interval: number;
  status: 'pending' | 'in_progress' | 'completed';
  reportName: string;
  reportData: string; // Base64 encoding of the report
  testedAt: Date | null;
}

export interface IStabilitySample {
  _id: Types.ObjectId;
  sampleCode: string;
  product: Types.ObjectId;
  batch: Types.ObjectId;
  section: Types.ObjectId | null;
  stabilityType: StabilityType;
  manufacturingDate: Date;
  expiryDate: Date | null;
  chargingDate: Date;
  quantity: number;
  intervals: number[];
  intervalTests: IIntervalTest[];
  status: SampleStatus;
  remarks: string;
  isArchived: boolean;
  isDeleted: boolean;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const sampleSchema = new Schema<IStabilitySample>(
  {
    sampleCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    batch: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    section: { type: Schema.Types.ObjectId, ref: 'Section', default: null },
    stabilityType: { type: String, enum: STABILITY_TYPES, required: true },
    manufacturingDate: { type: Date, required: true },
    expiryDate: { type: Date, default: null },
    chargingDate: { type: Date, required: true },
    quantity: { type: Number, required: true, min: 0 },
    intervals: { type: [Number], required: true },
    intervalTests: {
      type: [
        {
          interval: { type: Number, required: true },
          status: {
            type: String,
            enum: ['pending', 'in_progress', 'completed'],
            default: 'pending',
          },
          reportName: { type: String, default: '' },
          reportData: { type: String, default: '' },
          testedAt: { type: Date, default: null },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ['registered', 'running', 'completed'],
      default: 'registered',
    },
    remarks: { type: String, default: '' },
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// Pre-save hook to ensure intervalTests is kept in sync with the intervals array.
sampleSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('intervals')) {
    const existingMap = new Map((this.intervalTests || []).map((t) => [t.interval, t]));
    this.intervalTests = this.intervals.map((i) => {
      const existing = existingMap.get(i);
      return (
        existing || {
          interval: i,
          status: 'pending',
          reportName: '',
          reportData: '',
          testedAt: null,
        }
      );
    });
  }
  next();
});

sampleSchema.index({ isDeleted: 1, isArchived: 1, status: 1 });

export const StabilitySampleModel = model<IStabilitySample>('StabilitySample', sampleSchema);
