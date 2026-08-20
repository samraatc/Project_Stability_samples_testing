import { z } from 'zod';
import { STABILITY_INTERVAL_MONTHS, STABILITY_TYPES } from '../../constants/permissions';
import { listQuerySchema, objectIdSchema } from '../../utils/crud';

const intervalSchema = z
  .number()
  .int()
  .min(1, 'Interval month must be at least 1')
  .max(120, 'Interval month cannot exceed 120');

export const createSampleSchema = z
  .object({
    sampleCode: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().trim().min(1).max(50).optional(),
    ),
    productId: objectIdSchema,
    batchId: objectIdSchema,
    sectionId: z.preprocess(
      (val) => (val === '' ? null : val),
      objectIdSchema.nullable().optional(),
    ),
    stabilityType: z.enum(STABILITY_TYPES),
    manufacturingDate: z.coerce.date(),
    expiryDate: z.preprocess(
      (val) => (val === '' || val === null ? null : val),
      z.coerce.date().nullable().optional(),
    ),
    chargingDate: z.coerce.date(),
    quantity: z.coerce.number().min(0, 'Quantity must be zero or more'),
    intervals: z
      .array(intervalSchema)
      .min(1, 'At least one interval is required')
      .optional(),
    remarks: z.string().max(2000).default(''),
  })
  .superRefine((v, ctx) => {
    if (v.expiryDate && v.expiryDate <= v.manufacturingDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiryDate'],
        message: 'Expiry date must be after the manufacturing date',
      });
    }
    if (v.chargingDate < v.manufacturingDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['chargingDate'],
        message: 'Charging date cannot be before the manufacturing date',
      });
    }
    if (v.intervals) {
      const invalid = v.intervals.filter(
        (m) => !(STABILITY_INTERVAL_MONTHS as readonly number[]).includes(m),
      );
      if (invalid.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['intervals'],
          message: `Intervals must be standard pull points: ${STABILITY_INTERVAL_MONTHS.join(', ')}`,
        });
      }
    }
  });

export const updateSampleSchema = z.object({
  quantity: z.coerce.number().min(0).optional(),
  remarks: z.string().max(2000).optional(),
  status: z.enum(['registered', 'running', 'completed']).optional(),
  expiryDate: z.coerce.date().nullable().optional(),
});

export const listSamplesSchema = listQuerySchema.extend({
  productId: objectIdSchema.optional(),
  status: z.enum(['registered', 'running', 'completed']).optional(),
  excludeStatus: z.enum(['registered', 'running', 'completed']).optional(),
  stabilityType: z.enum(STABILITY_TYPES).optional(),
  chamber: z.string().trim().optional(),
  interval: z.coerce.number().int().positive().optional(),
  mfgDate: z.string().trim().optional(),
  mfgDateFrom: z.string().trim().optional(),
  mfgDateTo: z.string().trim().optional(),
  expDate: z.string().trim().optional(),
  expDateFrom: z.string().trim().optional(),
  expDateTo: z.string().trim().optional(),
  chargeDate: z.string().trim().optional(),
  chargeDateFrom: z.string().trim().optional(),
  chargeDateTo: z.string().trim().optional(),
  sampleId: z.string().trim().optional(),
  prodCode: z.string().trim().optional(),
  batchCode: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type CreateSampleInput = z.infer<typeof createSampleSchema>;
export type UpdateSampleInput = z.infer<typeof updateSampleSchema>;
