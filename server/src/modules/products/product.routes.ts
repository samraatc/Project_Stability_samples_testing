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
import { ProductModel } from './product.model';

export const productsRouter = Router();
productsRouter.use(authenticate);

const productBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  code: z.string().trim().min(1, 'Code is required').max(50),
  category: z.string().trim().max(100).default(''),
  dosageForm: z.string().trim().max(100).default(''),
  strength: z.string().trim().max(100).default(''),
  storageConditions: z.string().trim().max(200).default(''),
  description: z.string().max(2000).default(''),
});

async function loadProduct(id: string) {
  const product = await ProductModel.findOne({ _id: id, isDeleted: false });
  if (!product) throw new AppError('Product not found', 404);
  return product;
}

/**
 * @openapi
 * /products:
 *   get:
 *     summary: List products (search, pagination, archived filter)
 *     tags: [Products]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated products }
 */
productsRouter.get(
  '/',
  requirePermission(PERMISSIONS.PRODUCTS_READ),
  async (req: Request, res: Response) => {
    const query = parseQuery(listQuerySchema, req.query);
    const filter = baseListFilter(query, ['name', 'code', 'category']);
    const [items, total] = await Promise.all([
      ProductModel.find(filter)
        .sort({ name: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      ProductModel.countDocuments(filter),
    ]);
    res.json({ success: true, data: paginated(items, total, query.page, query.limit) });
  },
);

productsRouter.post(
  '/',
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE),
  validate(productBodySchema),
  async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof productBodySchema>;
    const code = body.code.toUpperCase();
    if (await ProductModel.exists({ code })) {
      throw new AppError('A product with this code already exists', 409);
    }
    const created = await ProductModel.create({ ...body, code, createdBy: actorIdOf(req) });
    auditFrom(req, 'products.create', 'products', created._id.toString(), { code });
    res.status(201).json({ success: true, data: created });
  },
);

productsRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE),
  validate(productBodySchema.partial()),
  async (req: Request, res: Response) => {
    const product = await loadProduct(req.params.id as string);
    const body = req.body as Partial<z.infer<typeof productBodySchema>>;
    if (body.code) {
      const code = body.code.toUpperCase();
      if (code !== product.code && (await ProductModel.exists({ code }))) {
        throw new AppError('A product with this code already exists', 409);
      }
      body.code = code;
    }
    Object.assign(product, body, { updatedBy: actorIdOf(req) });
    await product.save();
    auditFrom(req, 'products.update', 'products', product._id.toString(), { ...body });
    res.json({ success: true, data: product });
  },
);

for (const [action, isArchived] of [
  ['archive', true],
  ['restore', false],
] as const) {
  productsRouter.post(
    `/:id/${action}`,
    requirePermission(PERMISSIONS.PRODUCTS_MANAGE),
    async (req: Request, res: Response) => {
      const product = await loadProduct(req.params.id as string);
      product.isArchived = isArchived;
      product.updatedBy = actorIdOf(req);
      await product.save();
      auditFrom(req, `products.${action}`, 'products', product._id.toString());
      res.json({ success: true, data: product });
    },
  );
}

productsRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE),
  async (req: Request, res: Response) => {
    const product = await loadProduct(req.params.id as string);
    product.isDeleted = true;
    product.updatedBy = actorIdOf(req);
    await product.save();
    auditFrom(req, 'products.delete', 'products', product._id.toString(), {
      code: product.code,
    });
    res.json({ success: true, message: 'Product deleted' });
  },
);
