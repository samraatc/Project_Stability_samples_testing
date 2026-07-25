import { isAxiosError } from 'axios';
import type { ReactNode } from 'react';
import type { Paginated } from '@/features/admin/types';

export const inputClass =
  'mt-1 w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150';

export const btnPrimary =
  'px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition duration-150 cursor-pointer shadow-sm shadow-blue-500/10 flex items-center justify-center gap-1.5';

export const btnSecondary =
  'px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 rounded-xl transition duration-150 cursor-pointer flex items-center justify-center gap-1.5';

export const btnGhost =
  'px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-center gap-1.5';

export const btnDanger =
  'px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer flex items-center justify-center gap-1.5';

export function apiErrorMessage(error: unknown): string {
  return isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? (error.response.data.message as string)
    : 'Something went wrong. Please try again.';
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mt-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/10 dark:border-red-900/30 px-4 py-3 text-xs text-red-700 dark:text-red-400 flex items-center gap-2 font-medium"
    >
      <span>⚠️</span>
      <span>{message}</span>
    </div>
  );
}

export function Pager({
  data,
  page,
  onPage,
}: {
  data: Paginated<unknown> | undefined;
  page: number;
  onPage: (page: number) => void;
}) {
  if (!data || data.totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
      <span>
        Page {data.page} of {data.totalPages} ({data.total} items)
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className={btnGhost}
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= data.totalPages}
          onClick={() => onPage(page + 1)}
          className={btnGhost}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  count,
  description,
  actions,
}: {
  title: string;
  count?: number;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-5 mb-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <span>{title}</span>
          {count !== undefined && (
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-105 dark:border-blue-900/30">
              {count} items
            </span>
          )}
        </h1>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-start sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-xs ${className}`}
    >
      {children}
    </div>
  );
}

export function SkeletonLoader({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse p-4">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ message = 'No records found.' }: { message?: string }) {
  return (
    <div className="text-center py-12 px-4 italic text-slate-400 dark:text-slate-500 text-xs">
      {message}
    </div>
  );
}
