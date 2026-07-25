import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmModal } from '@/components/confirm-modal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createUser,
  deleteUser,
  fetchRoles,
  fetchUsers,
  resetUserPassword,
  updateUser,
} from '@/features/admin/api';
import type { ManagedUser } from '@/features/admin/types';
import { useAuth } from '@/features/auth/auth-context';
import {
  ErrorBanner,
  Pager,
  PageHeader,
  apiErrorMessage,
  btnPrimary,
  btnGhost,
  btnDanger,
  inputClass,
} from '@/components/ui';

const createUserFormSchema = z.object({
  email: z.string().email('Enter a valid email'),
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  roleId: z.string().min(1, 'Select a role'),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character'),
});

type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

export function UsersPage() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Password reset modal state
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  const usersQuery = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => fetchUsers({ page, search }),
  });
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: fetchRoles });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      setShowCreate(false);
      void invalidate();
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (target: ManagedUser) =>
      updateUser(target.id, {
        status: target.status === 'active' ? 'inactive' : 'active',
      }),
    onSuccess: () => void invalidate(),
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, roleId }: { id: string; roleId: string }) => updateUser(id, { roleId }),
    onSuccess: () => void invalidate(),
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => void invalidate(),
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      resetUserPassword(id, newPassword),
    onSuccess: () => {
      setResetSuccess(true);
      setResetError(null);
      setTimeout(() => {
        setResetTarget(null);
        setResetPassword('');
        setResetSuccess(false);
      }, 1800);
    },
    onError: (error) => setResetError(apiErrorMessage(error)),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: { email: '', firstName: '', lastName: '', roleId: '', password: '' },
  });

  const onCreate = (values: CreateUserFormValues) =>
    createMutation.mutateAsync(values).then(() => reset());

  const data = usersQuery.data;

  const password = watch('password') || '';

  const passwordRequirements = [
    { label: 'At least 10 characters', met: password.length >= 10 },
    { label: 'At least one lowercase letter', met: /[a-z]/.test(password) },
    { label: 'At least one uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'At least one number', met: /[0-9]/.test(password) },
    { label: 'At least one special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  // Reset password form requirements
  const resetPwdRequirements = [
    { label: 'At least 10 characters', met: resetPassword.length >= 10 },
    { label: 'At least one lowercase letter', met: /[a-z]/.test(resetPassword) },
    { label: 'At least one uppercase letter', met: /[A-Z]/.test(resetPassword) },
    { label: 'At least one number', met: /[0-9]/.test(resetPassword) },
    { label: 'At least one special character', met: /[^A-Za-z0-9]/.test(resetPassword) },
  ];
  const resetPwdValid = resetPwdRequirements.every((r) => r.met);

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Accounts"
        count={data?.total}
        description="Administer laboratory users, assign access roles, and modify account statuses."
        actions={
          <div className="flex items-center gap-3">
            <input
              type="search"
              placeholder="Search users…"
              aria-label="Search users"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-56 text-xs rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-1.5 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="button"
              onClick={() => {
                setShowCreate((v) => !v);
                setActionError(null);
              }}
              className={btnPrimary}
            >
              {showCreate ? 'Close Form' : 'New User'}
            </button>
          </div>
        }
      />

      <ErrorBanner message={actionError} />

      {showCreate && (
        <form
          onSubmit={handleSubmit(onCreate)}
          noValidate
          className="card-panel grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4"
        >
          <div>
            <label htmlFor="new-email" className="form-label">
              Email Address
            </label>
            <input id="new-email" type="email" className={inputClass} {...register('email')} />
            {errors.email && (
              <p className="mt-1 text-[11px] text-red-600 font-semibold">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="new-role" className="form-label">
              Assigned Role
            </label>
            <select id="new-role" className={inputClass} {...register('roleId')}>
              <option value="">Select a role…</option>
              {rolesQuery.data?.roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {errors.roleId && (
              <p className="mt-1 text-[11px] text-red-600 font-semibold">{errors.roleId.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="new-first" className="form-label">
              First name
            </label>
            <input id="new-first" className={inputClass} {...register('firstName')} />
            {errors.firstName && (
              <p className="mt-1 text-[11px] text-red-600 font-semibold">
                {errors.firstName.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="new-last" className="form-label">
              Last name
            </label>
            <input id="new-last" className={inputClass} {...register('lastName')} />
            {errors.lastName && (
              <p className="mt-1 text-[11px] text-red-600 font-semibold">
                {errors.lastName.message}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="new-password" className="form-label">
              Initial password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-[11px] text-red-655 dark:text-red-400 font-semibold">
                {errors.password.message}
              </p>
            )}

            {/* Real-time Password Requirements */}
            <div className="mt-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-2">
              <span className="font-bold text-slate-400 dark:text-slate-500 block uppercase tracking-wider text-[10px]">
                Password Strength Checklist
              </span>
              <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {passwordRequirements.map((req, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-[11px] transition-colors duration-200 ${
                      req.met
                        ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                        : password.length > 0
                          ? 'text-rose-650 dark:text-rose-400 font-medium'
                          : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <span className="flex-shrink-0">
                      {req.met ? (
                        <svg
                          className="h-3.5 w-3.5 text-emerald-650 dark:text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : password.length > 0 ? (
                        <svg
                          className="h-3.5 w-3.5 text-rose-500 dark:text-rose-450"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700 ml-1.5 mr-1" />
                      )}
                    </span>
                    <span>{req.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="submit" disabled={isSubmitting} className={btnPrimary}>
              {isSubmitting ? 'Creating…' : 'Create User'}
            </button>
          </div>
          {createMutation.isError && (
            <p role="alert" className="text-xs text-red-600 sm:col-span-2 font-semibold mt-2">
              ⚠️ {apiErrorMessage(createMutation.error)}
            </p>
          )}
        </form>
      )}

      <div className="table-container">
        <table className="table-admin">
          <thead>
            <tr>
              <th className="px-4 py-3">S.N.</th>
              <th className="px-4 py-3">User Details</th>
              <th className="px-4 py-3">Assigned Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Loading system users…
                </td>
              </tr>
            )}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No users found.
                </td>
              </tr>
            )}
            {data?.items.map((u, index) => (
              <tr key={u.id}>
                <td className="px-4 py-3 text-slate-500 font-medium">
                  {(page - 1) * 10 + index + 1}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>
                      {u.firstName} {u.lastName}
                    </span>
                    {u.id === me?.id && (
                      <span className="text-[9px] font-extrabold uppercase bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/30">
                        you
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {u.email}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Role for ${u.email}`}
                    value={u.role.id}
                    disabled={u.id === me?.id}
                    onChange={(e) => {
                      setActionError(null);
                      changeRoleMutation.mutate({ id: u.id, roleId: e.target.value });
                    }}
                    className="text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1 bg-white dark:bg-slate-950 text-slate-800 dark:text-white disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-900"
                  >
                    {rolesQuery.data?.roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      u.status === 'active'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50'
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-medium">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={u.id === me?.id}
                      onClick={() => {
                        setResetTarget(u);
                        setResetPassword('');
                        setResetError(null);
                        setResetSuccess(false);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-white dark:bg-slate-900 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                        />
                      </svg>
                      Reset Pwd
                    </button>
                    <button
                      type="button"
                      disabled={u.id === me?.id}
                      onClick={() => {
                        setActionError(null);
                        toggleStatusMutation.mutate(u);
                      }}
                      className={btnGhost}
                    >
                      {u.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      disabled={u.id === me?.id}
                      onClick={() => {
                        setActionError(null);
                        setConfirmModal({
                          title: 'Delete User Account',
                          message: `Are you sure you want to permanently delete user "${u.email}"? This will disable account logins.`,
                          onConfirm: () => {
                            deleteMutation.mutate(u.id);
                            setConfirmModal(null);
                          },
                        });
                      }}
                      className={btnDanger}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager data={data} page={page} onPage={setPage} />

      <ConfirmModal
        isOpen={!!confirmModal}
        title={confirmModal?.title || ''}
        message={confirmModal?.message || ''}
        onConfirm={confirmModal?.onConfirm || (() => {})}
        onCancel={() => setConfirmModal(null)}
      />

      {/* Password Reset Modal */}
      {resetTarget &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-100 dark:border-slate-800 animate-modal-scale">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center">
                    <svg
                      className="h-5 w-5 text-amber-600 dark:text-amber-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Reset Password
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Set a new password for{' '}
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {resetTarget.firstName} {resetTarget.lastName}
                      </span>{' '}
                      ({resetTarget.email})
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                {resetSuccess ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-3">
                    <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                      <svg
                        className="h-6 w-6 text-emerald-600 dark:text-emerald-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      Password Reset Successfully!
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                      All existing sessions have been revoked. The user must log in with the new
                      password.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label htmlFor="reset-pwd" className="form-label">
                        New Password
                      </label>
                      <input
                        id="reset-pwd"
                        type="password"
                        autoComplete="new-password"
                        value={resetPassword}
                        onChange={(e) => {
                          setResetPassword(e.target.value);
                          setResetError(null);
                        }}
                        placeholder="Enter new password…"
                        className={inputClass}
                      />
                    </div>

                    {/* Strength Checklist */}
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-2">
                      <span className="font-bold text-slate-400 dark:text-slate-500 block uppercase tracking-wider text-[10px]">
                        Password Requirements
                      </span>
                      <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                        {resetPwdRequirements.map((req, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 text-[11px] transition-colors duration-200 ${
                              req.met
                                ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                : resetPassword.length > 0
                                  ? 'text-rose-600 dark:text-rose-400 font-medium'
                                  : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            <span className="flex-shrink-0">
                              {req.met ? (
                                <svg
                                  className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              ) : resetPassword.length > 0 ? (
                                <svg
                                  className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              ) : (
                                <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700 ml-1.5 mr-1" />
                              )}
                            </span>
                            <span>{req.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30">
                      <span className="text-amber-600 dark:text-amber-400 text-sm mt-px">⚠️</span>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed font-medium">
                        This will immediately change the user's password and revoke all active
                        sessions. The user will need to log in again with the new password.
                      </p>
                    </div>

                    {resetError && (
                      <div className="rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/10 px-3 py-2 text-xs text-red-700 dark:text-red-400 font-medium">
                        ⚠️ {resetError}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              {!resetSuccess && (
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResetTarget(null);
                      setResetPassword('');
                      setResetError(null);
                    }}
                    className={btnGhost}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!resetPwdValid || resetPasswordMutation.isPending}
                    onClick={() => {
                      resetPasswordMutation.mutate({
                        id: resetTarget.id,
                        newPassword: resetPassword,
                      });
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition duration-150 cursor-pointer shadow-sm"
                  >
                    {resetPasswordMutation.isPending ? 'Resetting…' : 'Reset Password'}
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
