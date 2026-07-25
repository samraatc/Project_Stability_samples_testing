import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '@/features/auth/auth-context';

const loginFormSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  if (!isLoading && user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      await login(values.email, values.password, values.rememberMe);
      navigate('/', { replace: true });
    } catch (error) {
      const message =
        isAxiosError(error) && typeof error.response?.data?.message === 'string'
          ? (error.response.data.message as string)
          : 'Unable to sign in. Please try again.';
      setServerError(message);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 transition-colors duration-300">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl shadow-slate-200/20 dark:shadow-none transition-all duration-300">
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center justify-center md:justify-start gap-2">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black shadow-md shadow-blue-500/20">
              N
            </span>
            <span>NESMS Portal</span>
          </h1>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Sign in to the National Enterprise Stability Management System
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/30 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-400 font-medium"
            >
              ⚠️ {serverError}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={`w-full text-xs rounded-xl border px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                errors.email
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-slate-250 dark:border-slate-800 focus:border-blue-500'
              }`}
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-[11px] font-medium text-red-650 dark:text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className={`w-full text-xs rounded-xl border px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                errors.password
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-slate-250 dark:border-slate-800 focus:border-blue-500'
              }`}
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-[11px] font-medium text-red-655 dark:text-red-400">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="flex items-center">
            <label className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded-lg border-slate-300 dark:border-slate-800 dark:bg-slate-950 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                {...register('rememberMe')}
              />
              Remember me for 30 days
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition duration-150 cursor-pointer shadow-sm shadow-blue-500/10 flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
