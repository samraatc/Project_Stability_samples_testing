import { z } from 'zod';
import { STABILITY_TYPES } from './types';

export const productFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  category: z.string(),
  dosageForm: z.string(),
  strength: z.string(),
  storageConditions: z.string(),
});

export const batchFormSchema = z.object({
  batchNo: z.string().max(50),
  batchCode: z.string().min(1, 'Batch code is required'),
  productId: z.string().min(1, 'Select a product'),
  manufacturingDate: z.string().min(1, 'Required'),
  notes: z.string(),
});

export const sampleFormSchema = z
  .object({
    productId: z.string().min(1, 'Select a product'),
    batchId: z.string().min(1, 'Select a batch'),
    sectionId: z.string().optional(),
    stabilityType: z.enum(STABILITY_TYPES),
    manufacturingDate: z.string().min(1, 'Required'),
    expiryDate: z.string().optional(),
    chargingDate: z.string().min(1, 'Required'),
    quantity: z.coerce.number().min(0, 'Quantity must be zero or more'),
    intervals: z.array(z.number()).optional(),
    remarks: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.expiryDate && new Date(v.expiryDate) <= new Date(v.manufacturingDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiryDate'],
        message: 'Expiry must be after manufacturing date',
      });
    }
    if (new Date(v.chargingDate) < new Date(v.manufacturingDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['chargingDate'],
        message: 'Charging date cannot be before manufacturing date',
      });
    }
  });

export type ProductFormValues = z.infer<typeof productFormSchema>;
export type BatchFormValues = z.infer<typeof batchFormSchema>;
export type SampleFormValues = z.infer<typeof sampleFormSchema>;
