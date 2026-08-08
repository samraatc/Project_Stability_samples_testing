import { Router } from 'express';
import type { Request, Response } from 'express';
import { Types, type PipelineStage } from 'mongoose';
import { authenticate } from '../../middlewares/authenticate';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { AppError } from '../../utils/app-error';
import { escapeRegex, paginated, parseQuery } from '../../utils/query';
import { auditFrom, actorIdOf } from '../../utils/crud';
import { PERMISSIONS } from '../../constants/permissions';
import { StabilitySampleModel } from './sample.model';
import { cloneSample, createSample, isTestingComplete } from './sample.service';
import {
  createSampleSchema,
  listSamplesSchema,
  updateSampleSchema,
  type CreateSampleInput,
  type UpdateSampleInput,
} from './sample.validation';

export const samplesRouter = Router();
samplesRouter.use(authenticate);

async function loadSample(id: string) {
  const sample = await StabilitySampleModel.findOne({ _id: id, isDeleted: false });
  if (!sample) throw new AppError('Sample not found', 404);
  return sample;
}

/**
 * @openapi
 * /samples:
 *   get:
 *     summary: List stability samples (search, product/status/type filters)
 *     tags: [Samples]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated samples with product, batch, and section info }
 *   post:
 *     summary: Register a stability sample (code auto-generated when omitted)
 *     tags: [Samples]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Sample created }
 */
samplesRouter.get(
  '/',
  requirePermission(PERMISSIONS.SAMPLES_READ),
  async (req: Request, res: Response) => {
    const query = parseQuery(listSamplesSchema, req.query);
    const matchStage: Record<string, unknown> = {
      isDeleted: false,
      isArchived: query.archived ?? false,
    };

    if (query.status) {
      matchStage.status = query.status;
    } else if (query.excludeStatus) {
      matchStage.status = { $ne: query.excludeStatus };
    }

    if (query.stabilityType) {
      matchStage.stabilityType = query.stabilityType;
    }

    if (query.productId) {
      matchStage.product = new Types.ObjectId(query.productId);
    }

    if (query.interval) {
      matchStage.intervals = query.interval;
    }

    if (query.mfgDateFrom || query.mfgDateTo) {
      const filter: Record<string, Date> = {};
      if (query.mfgDateFrom) filter.$gte = new Date(query.mfgDateFrom);
      if (query.mfgDateTo) {
        const end = new Date(query.mfgDateTo);
        end.setHours(23, 59, 59, 999);
        filter.$lte = end;
      }
      matchStage.manufacturingDate = filter;
    } else if (query.mfgDate) {
      const start = new Date(query.mfgDate);
      const end = new Date(query.mfgDate);
      end.setDate(end.getDate() + 1);
      matchStage.manufacturingDate = { $gte: start, $lt: end };
    }

    if (query.expDateFrom || query.expDateTo) {
      const filter: Record<string, Date> = {};
      if (query.expDateFrom) filter.$gte = new Date(query.expDateFrom);
      if (query.expDateTo) {
        const end = new Date(query.expDateTo);
        end.setHours(23, 59, 59, 999);
        filter.$lte = end;
      }
      matchStage.expiryDate = filter;
    } else if (query.expDate) {
      const start = new Date(query.expDate);
      const end = new Date(query.expDate);
      end.setDate(end.getDate() + 1);
      matchStage.expiryDate = { $gte: start, $lt: end };
    }

    if (query.chargeDateFrom || query.chargeDateTo) {
      const filter: Record<string, Date> = {};
      if (query.chargeDateFrom) filter.$gte = new Date(query.chargeDateFrom);
      if (query.chargeDateTo) {
        const end = new Date(query.chargeDateTo);
        end.setHours(23, 59, 59, 999);
        filter.$lte = end;
      }
      matchStage.chargingDate = filter;
    } else if (query.chargeDate) {
      const start = new Date(query.chargeDate);
      const end = new Date(query.chargeDate);
      end.setDate(end.getDate() + 1);
      matchStage.chargingDate = { $gte: start, $lt: end };
    }

    if (query.sampleId) {
      matchStage.sampleCode = { $regex: escapeRegex(query.sampleId), $options: 'i' };
    }

    // Build the aggregation pipeline
    const pipeline: PipelineStage[] = [];

    // Always lookup related collections
    pipeline.push(
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'batches',
          localField: 'batch',
          foreignField: '_id',
          as: 'batchInfo',
        },
      },
      { $unwind: { path: '$batchInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'sections',
          localField: 'section',
          foreignField: '_id',
          as: 'sectionInfo',
        },
      },
      { $unwind: { path: '$sectionInfo', preserveNullAndEmptyArrays: true } },
    );

    // Apply match filters
    const matchFilter: Record<string, unknown> = { ...matchStage };

    if (query.prodCode) {
      matchFilter['productInfo.code'] = { $regex: escapeRegex(query.prodCode), $options: 'i' };
    }

    if (query.batchCode) {
      matchFilter['batchInfo.batchCode'] = { $regex: escapeRegex(query.batchCode), $options: 'i' };
    }

    if (query.chamber) {
      matchFilter['productInfo.storageConditions'] = {
        $regex: escapeRegex(query.chamber),
        $options: 'i',
      };
    }

    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      matchFilter.$or = [
        { sampleCode: { $regex: rx } },
        { 'productInfo.name': { $regex: rx } },
        { 'productInfo.code': { $regex: rx } },
        { 'batchInfo.batchCode': { $regex: rx } },
      ];
    }

    pipeline.push({ $match: matchFilter });

    // Run separate query/aggregation to count total matched items
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await StabilitySampleModel.aggregate(countPipeline).exec();
    const total = countResult[0]?.total || 0;

    // Add Sorting stage
    const sortField = query.sortBy || 'createdAt';
    const sortDirection = query.sortOrder === 'desc' ? -1 : 1;
    let sortStage: Record<string, 1 | -1> = {};
    if (sortField === 'productName') {
      sortStage = { 'productInfo.name': sortDirection };
    } else if (sortField === 'batchCode') {
      sortStage = { 'batchInfo.batchCode': sortDirection };
    } else {
      sortStage = { [sortField]: sortDirection };
    }
    pipeline.push({ $sort: sortStage });

    // Add Pagination stages
    pipeline.push({ $skip: (query.page - 1) * query.limit }, { $limit: query.limit });

    // Execute aggregation
    const items = await StabilitySampleModel.aggregate(pipeline).exec();

    // Map output to match Mongoose ref population layout expected by client
    const mappedItems = items.map((item) => {
      const isCompleted = isTestingComplete(item);
      const effectiveStatus = isCompleted ? 'completed' : item.status;
      return {
        ...item,
        status: effectiveStatus,
        product: item.productInfo || null,
        batch: item.batchInfo || null,
        section: item.sectionInfo || null,
        productInfo: undefined,
        batchInfo: undefined,
        sectionInfo: undefined,
      };
    });

    res.json({ success: true, data: paginated(mappedItems, total, query.page, query.limit) });
  },
);

samplesRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.SAMPLES_READ),
  async (req: Request, res: Response) => {
    const sample = await StabilitySampleModel.findOne({ _id: req.params.id, isDeleted: false })
      .populate('product')
      .populate('batch')
      .populate('section', 'name')
      .lean();
    if (!sample) throw new AppError('Sample not found', 404);
    if (isTestingComplete(sample as any)) {
      (sample as any).status = 'completed';
    }
    res.json({ success: true, data: sample });
  },
);

samplesRouter.post(
  '/',
  requirePermission(PERMISSIONS.SAMPLES_MANAGE),
  validate(createSampleSchema),
  async (req: Request, res: Response) => {
    const created = await createSample(req.body as CreateSampleInput, actorIdOf(req));
    auditFrom(req, 'samples.create', 'samples', created._id.toString(), {
      sampleCode: created.sampleCode,
    });
    res.status(201).json({ success: true, data: created });
  },
);

/**
 * @openapi
 * /samples/{id}/clone:
 *   post:
 *     summary: Clone a sample with a fresh code and registered status
 *     tags: [Samples]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Cloned sample }
 */
samplesRouter.post(
  '/:id/clone',
  requirePermission(PERMISSIONS.SAMPLES_MANAGE),
  async (req: Request, res: Response) => {
    const clone = await cloneSample(req.params.id as string, actorIdOf(req));
    auditFrom(req, 'samples.clone', 'samples', clone._id.toString(), {
      sourceId: req.params.id,
      sampleCode: clone.sampleCode,
    });
    res.status(201).json({ success: true, data: clone });
  },
);

samplesRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.SAMPLES_MANAGE),
  validate(updateSampleSchema),
  async (req: Request, res: Response) => {
    const sample = await loadSample(req.params.id as string);
    const input = req.body as UpdateSampleInput;

    if (input.status === 'completed') {
      if (!isTestingComplete(sample)) {
        throw new AppError(
          'Cannot mark this test as Completed. Required testing is still incomplete. Please complete all required month-wise tests and ensure all required results are successful before marking the sample as Completed.',
          400,
        );
      }
    }

    Object.assign(sample, input, { updatedBy: actorIdOf(req) });

    if (input.status === undefined) {
      if (isTestingComplete(sample)) {
        sample.status = 'completed';
      } else if (sample.status === 'completed') {
        sample.status = 'running';
      }
    }

    await sample.save();
    auditFrom(req, 'samples.update', 'samples', sample._id.toString(), { ...req.body });
    res.json({ success: true, data: sample });
  },
);

samplesRouter.patch(
  '/:id/intervals/:interval',
  requirePermission(PERMISSIONS.SAMPLES_MANAGE),
  async (req: Request, res: Response) => {
    const sample = await loadSample(req.params.id as string);
    const targetInterval = Number(req.params.interval);

    if (isNaN(targetInterval) || !sample.intervals.includes(targetInterval)) {
      throw new AppError('Invalid interval month', 400);
    }

    const { status, reportName, reportData } = req.body;
    if (status && !['pending', 'in_progress', 'completed'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    // Find or initialize target interval test
    let testIndex = sample.intervalTests.findIndex((t) => t.interval === targetInterval);
    if (testIndex === -1) {
      sample.intervalTests.push({
        interval: targetInterval,
        status: 'pending',
        reportName: '',
        reportData: '',
        testedAt: null,
      });
      testIndex = sample.intervalTests.length - 1;
    }

    const test = sample.intervalTests[testIndex];
    if (!test) {
      throw new AppError('Interval test not found', 500);
    }
    if (status) {
      test.status = status;
      if (status === 'completed') {
        test.testedAt = new Date();
      } else {
        test.testedAt = null;
      }
    }
    if (reportName !== undefined) test.reportName = reportName;
    if (reportData !== undefined) test.reportData = reportData;

    // Auto-check if all intervals are completed
    if (isTestingComplete(sample)) {
      sample.status = 'completed';
    } else if (sample.status === 'completed') {
      sample.status = 'running';
    }

    sample.updatedBy = actorIdOf(req);
    sample.markModified('intervalTests');
    await sample.save();

    auditFrom(req, 'samples.updateIntervalTest', 'samples', sample._id.toString(), {
      interval: targetInterval,
      status,
      reportName: reportName || undefined,
    });

    res.json({ success: true, data: sample });
  },
);

for (const [action, isArchived] of [
  ['archive', true],
  ['restore', false],
] as const) {
  samplesRouter.post(
    `/:id/${action}`,
    requirePermission(PERMISSIONS.SAMPLES_MANAGE),
    async (req: Request, res: Response) => {
      const sample = await loadSample(req.params.id as string);
      sample.isArchived = isArchived;
      sample.updatedBy = actorIdOf(req);
      await sample.save();
      auditFrom(req, `samples.${action}`, 'samples', sample._id.toString());
      res.json({ success: true, data: sample });
    },
  );
}

samplesRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.SAMPLES_MANAGE),
  async (req: Request, res: Response) => {
    const sample = await loadSample(req.params.id as string);
    sample.isDeleted = true;
    sample.updatedBy = actorIdOf(req);
    await sample.save();
    auditFrom(req, 'samples.delete', 'samples', sample._id.toString(), {
      sampleCode: sample.sampleCode,
    });
    res.json({ success: true, message: 'Sample deleted' });
  },
);
