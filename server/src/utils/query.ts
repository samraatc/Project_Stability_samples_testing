import { z, type ZodSchema } from 'zod';
import { AppError } from './app-error';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(10000).default(20),
});

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function paginated<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Parses req.query against a schema; throws a 400 AppError on failure. */
export function parseQuery<S extends ZodSchema>(schema: S, query: unknown): z.infer<S> {
  const result = schema.safeParse(query ?? {});
  if (!result.success) {
    const first = result.error.issues[0];
    throw new AppError(`Invalid query: ${first?.path.join('.')} ${first?.message}`, 400);
  }
  return result.data;
}

/** Escapes user input for safe use inside a RegExp (search filters). */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
