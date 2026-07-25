import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { AppError } from '../../utils/app-error';
import { paginated, parseQuery } from '../../utils/query';
import { auditFrom, actorIdOf, baseListFilter, listQuerySchema } from '../../utils/crud';
import { PERMISSIONS } from '../../constants/permissions';
import { SectionModel } from './section.model';

export const sectionsRouter = Router();
sectionsRouter.use(authenticate);

const sectionBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().max(1000).default(''),
});

/**
 * @openapi
 * /sections:
 *   get:
 *     summary: List sections
 *     tags: [Sections]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated sections }
 */
sectionsRouter.get(
  '/',
  requirePermission(PERMISSIONS.SECTIONS_READ),
  async (req: Request, res: Response) => {
    const query = parseQuery(listQuerySchema, req.query);
    const filter = baseListFilter(query, ['name']);
    const [items, total] = await Promise.all([
      SectionModel.find(filter)
        .sort({ name: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      SectionModel.countDocuments(filter),
    ]);
    res.json({ success: true, data: paginated(items, total, query.page, query.limit) });
  },
);

sectionsRouter.post(
  '/',
  requirePermission(PERMISSIONS.SECTIONS_MANAGE),
  validate(sectionBodySchema),
  async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof sectionBodySchema>;
    if (await SectionModel.exists({ name: body.name })) {
      throw new AppError('A section with this name already exists', 409);
    }
    const created = await SectionModel.create({ ...body, createdBy: actorIdOf(req) });
    auditFrom(req, 'sections.create', 'sections', created._id.toString(), { name: body.name });
    res.status(201).json({ success: true, data: created });
  },
);

sectionsRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.SECTIONS_MANAGE),
  validate(sectionBodySchema.partial()),
  async (req: Request, res: Response) => {
    const section = await SectionModel.findOne({ _id: req.params.id, isDeleted: false });
    if (!section) throw new AppError('Section not found', 404);
    Object.assign(section, req.body, { updatedBy: actorIdOf(req) });
    await section.save();
    auditFrom(req, 'sections.update', 'sections', section._id.toString());
    res.json({ success: true, data: section });
  },
);

for (const [action, isArchived] of [
  ['archive', true],
  ['restore', false],
] as const) {
  sectionsRouter.post(
    `/:id/${action}`,
    requirePermission(PERMISSIONS.SECTIONS_MANAGE),
    async (req: Request, res: Response) => {
      const section = await SectionModel.findOne({ _id: req.params.id, isDeleted: false });
      if (!section) throw new AppError('Section not found', 404);
      section.isArchived = isArchived;
      section.updatedBy = actorIdOf(req);
      await section.save();
      auditFrom(req, `sections.${action}`, 'sections', section._id.toString());
      res.json({ success: true, data: section });
    },
  );
}
