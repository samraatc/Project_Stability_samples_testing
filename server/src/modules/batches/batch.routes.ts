import { Router } from 'express';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { AppError } from '../../utils/app-error';
import { paginated, parseQuery } from '../../utils/query';
import {
  auditFrom,
  actorIdOf,
  baseListFilter,
  listQuerySchema,
  objectIdSchema,
} from '../../utils/crud';
import { PERMISSIONS } from '../../constants/permissions';
import { BatchModel } from './batch.model';
import { ProductModel } from '../products/product.model';

export const batchesRouter = Router();
batchesRouter.use(authenticate);

const batchBodySchema = z.object({
  batchNo: z.string().trim().max(50).default(''),
  batchCode: z.string().trim().min(1, 'Batch code is required').max(50),
  productId: objectIdSchema,
  manufacturingDate: z.coerce.date(),
  notes: z.string().max(1000).default(''),
});

const listBatchesSchema = listQuerySchema.extend({
  productId: objectIdSchema.optional(),
});

/**
 * @openapi
 * /batches:
 *   get:
 *     summary: List batches (search, product filter, pagination)
 *     tags: [Batches]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated batches with product info }
 */
batchesRouter.get(
  '/',
  requirePermission(PERMISSIONS.BATCHES_READ),
  async (req: Request, res: Response) => {
    const query = parseQuery(listBatchesSchema, req.query);
    const filter = baseListFilter(query, ['batchCode']);
    if (query.productId) filter.product = new Types.ObjectId(query.productId);

    const [items, total] = await Promise.all([
      BatchModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate('product', 'name code')
        .lean(),
      BatchModel.countDocuments(filter),
    ]);
    res.json({ success: true, data: paginated(items, total, query.page, query.limit) });
  },
);

batchesRouter.post(
  '/',
  requirePermission(PERMISSIONS.BATCHES_MANAGE),
  validate(batchBodySchema),
  async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof batchBodySchema>;

    const product = await ProductModel.findOne({ _id: body.productId, isDeleted: false });
    if (!product) throw new AppError('Product not found', 400);

    const batchCode = body.batchCode.toUpperCase();
    if (await BatchModel.exists({ product: product._id, batchCode, isDeleted: false })) {
      throw new AppError('This batch code already exists for the selected product', 409);
    }

    const created = await BatchModel.create({
      batchNo: body.batchNo,
      batchCode,
      product: product._id,
      manufacturingDate: body.manufacturingDate,
      notes: body.notes,
      createdBy: actorIdOf(req),
    });
    auditFrom(req, 'batches.create', 'batches', created._id.toString(), {
      batchCode,
      product: product.code,
    });
    res.status(201).json({ success: true, data: created });
  },
);

const batchUpdateSchema = z.object({
  batchNo: z.string().trim().max(50).optional(),
  batchCode: z.string().trim().min(1).max(50).optional(),
  manufacturingDate: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
});
batchesRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.BATCHES_MANAGE),
  validate(batchUpdateSchema),
  async (req: Request, res: Response) => {
    const batch = await BatchModel.findOne({ _id: req.params.id, isDeleted: false });
    if (!batch) throw new AppError('Batch not found', 404);
    Object.assign(batch, req.body, { updatedBy: actorIdOf(req) });
    await batch.save();
    auditFrom(req, 'batches.update', 'batches', batch._id.toString());
    res.json({ success: true, data: batch });
  },
);

batchesRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.BATCHES_MANAGE),
  async (req: Request, res: Response) => {
    const batch = await BatchModel.findOne({ _id: req.params.id, isDeleted: false });
    if (!batch) throw new AppError('Batch not found', 404);
    batch.isDeleted = true;
    batch.updatedBy = actorIdOf(req);
    await batch.save();
    auditFrom(req, 'batches.delete', 'batches', batch._id.toString(), {
      batchCode: batch.batchCode,
    });
    res.json({ success: true, message: 'Batch deleted' });
  },
);
