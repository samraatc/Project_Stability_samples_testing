import { z } from 'zod';
import { passwordSchema } from '../../utils/password';
import { paginationSchema } from '../../utils/query';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const createUserSchema = z.object({
  email: z.string().email('A valid email is required'),
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  roleId: objectId,
  password: passwordSchema,
});

export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    roleId: objectId.optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No changes provided' });

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
});

export const listUsersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(200).optional(),
  role: z.string().trim().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
