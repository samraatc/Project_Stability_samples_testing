import { Types } from 'mongoose';
import { AppError } from '../../utils/app-error';
import { DEFAULT_INTERVALS_BY_TYPE } from '../../constants/permissions';
import { StabilitySampleModel, type IStabilitySample } from './sample.model';
import { BatchModel } from '../batches/batch.model';
import { ProductModel } from '../products/product.model';
import { SectionModel } from '../sections/section.model';
import type { CreateSampleInput } from './sample.validation';

/**
 * Sequential, human-readable sample codes: STB-<year>-<counter>.
 * Count-based generation is fine at current volume; a dedicated counter
 * collection can replace it if concurrent imports become a thing.
 */
async function nextSampleCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `STB-${year}-`;
  const count = await StabilitySampleModel.countDocuments({
    sampleCode: new RegExp(`^${prefix}`),
  });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

export async function resolveSampleRefs(input: CreateSampleInput) {
  const [product, batch, section] = await Promise.all([
    ProductModel.findOne({ _id: input.productId, isDeleted: false }),
    BatchModel.findOne({ _id: input.batchId, isDeleted: false }),
    input.sectionId ? SectionModel.findOne({ _id: input.sectionId, isDeleted: false }) : null,
  ]);
  if (!product) throw new AppError('Product not found', 400);
  if (!batch) throw new AppError('Batch not found', 400);
  if (input.sectionId && !section) throw new AppError('Section not found', 400);
  if (batch.product.toString() !== product._id.toString()) {
    throw new AppError('The selected batch does not belong to the selected product', 400);
  }
  return { product, batch, section };
}

export async function createSample(
  input: CreateSampleInput,
  actorId: Types.ObjectId,
): Promise<IStabilitySample> {
  const { product, batch, section } = await resolveSampleRefs(input);

  const sampleCode = input.sampleCode?.toUpperCase() ?? (await nextSampleCode());
  if (await StabilitySampleModel.exists({ sampleCode })) {
    throw new AppError('A sample with this code already exists', 409);
  }

  const rawIntervals =
    input.intervals && input.intervals.length > 0
      ? input.intervals
      : DEFAULT_INTERVALS_BY_TYPE[input.stabilityType] || [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
  const sortedIntervals = Array.from(new Set(rawIntervals)).sort((a, b) => a - b);

  return StabilitySampleModel.create({
    sampleCode,
    product: product._id,
    batch: batch._id,
    section: section ? section._id : null,
    stabilityType: input.stabilityType,
    manufacturingDate: input.manufacturingDate,
    expiryDate: input.expiryDate ?? null,
    chargingDate: input.chargingDate,
    quantity: input.quantity,
    intervals: sortedIntervals,
    remarks: input.remarks,
    createdBy: actorId,
  });
}

export async function cloneSample(id: string, actorId: Types.ObjectId): Promise<IStabilitySample> {
  const source = await StabilitySampleModel.findOne({ _id: id, isDeleted: false }).lean();
  if (!source) throw new AppError('Sample not found', 404);

  return StabilitySampleModel.create({
    ...source,
    _id: new Types.ObjectId(),
    sampleCode: await nextSampleCode(),
    status: 'registered',
    isArchived: false,
    createdBy: actorId,
    updatedBy: null,
    createdAt: undefined,
    updatedAt: undefined,
  });
}

export function isTestingComplete(sample: {
  intervals?: number[];
  intervalTests?: Array<{ interval: number; status: string }>;
}): boolean {
  if (!sample.intervals || sample.intervals.length === 0) return false;
  if (!sample.intervalTests || sample.intervalTests.length === 0) return false;

  return sample.intervals.every((month) => {
    const test = sample.intervalTests!.find((t) => t.interval === month);
    return Boolean(test && test.status === 'completed');
  });
}
