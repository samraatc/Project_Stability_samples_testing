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
import { CategoryModel } from './category.model';

export const categoriesRouter = Router();
categoriesRouter.use(authenticate);

const categoryBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().max(1000).default(''),
});

/**
 * @openapi
 * /categories:
 *   get:
 *     summary: List categories
 *     tags: [Categories]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated categories }
 */
categoriesRouter.get(
  '/',
  requirePermission(PERMISSIONS.CATEGORIES_READ),
  async (req: Request, res: Response) => {
    const query = parseQuery(listQuerySchema, req.query);
    const filter = baseListFilter(query, ['name']);
    const [items, total] = await Promise.all([
      CategoryModel.find(filter)
        .sort({ name: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      CategoryModel.countDocuments(filter),
    ]);
    res.json({ success: true, data: paginated(items, total, query.page, query.limit) });
  },
);

const PRESET_COLORS = [
  '#1d4ed8', // blue-700
  '#047857', // emerald-700
  '#4338ca', // indigo-700
  '#6b21a8', // purple-700
  '#be185d', // pink-700
  '#b91c1c', // red-700
  '#c2410c', // orange-700
  '#0f766e', // teal-700
  '#0369a1', // sky-700
  '#a21caf', // fuchsia-700
  '#78350f', // amber-900
  '#334155', // slate-700
];

const getRandomColor = () => PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];

categoriesRouter.post(
  '/',
  requirePermission(PERMISSIONS.CATEGORIES_MANAGE),
  validate(categoryBodySchema),
  async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof categoryBodySchema>;
    if (await CategoryModel.exists({ name: body.name, isDeleted: false })) {
      throw new AppError('A category with this name already exists', 409);
    }
    const created = await CategoryModel.create({
      ...body,
      color: getRandomColor(),
      createdBy: actorIdOf(req),
    });
    auditFrom(req, 'categories.create', 'categories', created._id.toString(), {
      name: body.name,
    });
    res.status(201).json({ success: true, data: created });
  },
);

categoriesRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.CATEGORIES_MANAGE),
  validate(categoryBodySchema.partial()),
  async (req: Request, res: Response) => {
    const category = await CategoryModel.findOne({ _id: req.params.id, isDeleted: false });
    if (!category) throw new AppError('Category not found', 404);
    Object.assign(category, req.body, { updatedBy: actorIdOf(req) });
    await category.save();
    auditFrom(req, 'categories.update', 'categories', category._id.toString());
    res.json({ success: true, data: category });
  },
);

categoriesRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.CATEGORIES_MANAGE),
  async (req: Request, res: Response) => {
    const category = await CategoryModel.findOne({ _id: req.params.id, isDeleted: false });
    if (!category) throw new AppError('Category not found', 404);
    category.isDeleted = true;
    category.updatedBy = actorIdOf(req);
    await category.save();
    auditFrom(req, 'categories.delete', 'categories', category._id.toString(), {
      name: category.name,
    });
    res.json({ success: true, message: 'Category deleted' });
  },
);

for (const [action, isArchived] of [
  ['archive', true],
  ['restore', false],
] as const) {
  categoriesRouter.post(
    `/:id/${action}`,
    requirePermission(PERMISSIONS.CATEGORIES_MANAGE),
    async (req: Request, res: Response) => {
      const category = await CategoryModel.findOne({ _id: req.params.id, isDeleted: false });
      if (!category) throw new AppError('Category not found', 404);
      category.isArchived = isArchived;
      category.updatedBy = actorIdOf(req);
      await category.save();
      auditFrom(req, `categories.${action}`, 'categories', category._id.toString());
      res.json({ success: true, data: category });
    },
  );
}
