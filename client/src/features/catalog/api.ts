import { api } from '@/lib/api';
import type { Paginated } from '@/features/admin/types';
import type { Batch, Category, Product, Sample, Section } from './types';

async function list<T>(path: string, params: Record<string, unknown>): Promise<Paginated<T>> {
  const res = await api.get<{ data: Paginated<T> }>(path, { params });
  return res.data.data;
}

export const catalogApi = {
  products: {
    list: (params: { page?: number; search?: string; archived?: boolean; limit?: number }) =>
      list<Product>('/products', params),
    create: (body: Partial<Product>) => api.post('/products', body),
    update: (id: string, body: Partial<Product>) => api.patch(`/products/${id}`, body),
    archive: (id: string) => api.post(`/products/${id}/archive`),
    restore: (id: string) => api.post(`/products/${id}/restore`),
    remove: (id: string) => api.delete(`/products/${id}`),
  },
  sections: {
    list: (params: { page?: number; archived?: boolean; limit?: number }) =>
      list<Section>('/sections', params),
    create: (body: { name: string; description?: string }) => api.post('/sections', body),
    update: (id: string, body: Partial<{ name: string; description: string }>) =>
      api.patch(`/sections/${id}`, body),
    archive: (id: string) => api.post(`/sections/${id}/archive`),
    restore: (id: string) => api.post(`/sections/${id}/restore`),
  },
  batches: {
    list: (params: { page?: number; search?: string; productId?: string; limit?: number }) =>
      list<Batch>('/batches', params),
    create: (body: {
      batchNo?: string;
      batchCode: string;
      productId: string;
      manufacturingDate: string;
      notes?: string;
    }) => api.post('/batches', body),
    update: (id: string, body: Partial<Omit<Batch, '_id' | 'product'>>) =>
      api.patch(`/batches/${id}`, body),
    remove: (id: string) => api.delete(`/batches/${id}`),
  },
  samples: {
    get: (id: string) => api.get<{ data: Sample }>(`/samples/${id}`).then((res) => res.data.data),
    list: (params: {
      page?: number;
      search?: string;
      productId?: string;
      status?: string;
      excludeStatus?: string;
      stabilityType?: string;
      chamber?: string;
      interval?: number;
      mfgDate?: string;
      mfgDateFrom?: string;
      mfgDateTo?: string;
      expDate?: string;
      expDateFrom?: string;
      expDateTo?: string;
      chargeDate?: string;
      chargeDateFrom?: string;
      chargeDateTo?: string;
      sampleId?: string;
      prodCode?: string;
      batchCode?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      archived?: boolean;
      limit?: number;
    }) => list<Sample>('/samples', params),
    create: (body: Record<string, unknown>) => api.post('/samples', body),
    update: (
      id: string,
      body: Partial<Pick<Sample, 'quantity' | 'remarks' | 'status' | 'expiryDate'>>,
    ) => api.patch(`/samples/${id}`, body),
    updateInterval: (
      id: string,
      interval: number,
      body: { status: string; reportName?: string; reportData?: string },
    ) =>
      api
        .patch<{ data: Sample }>(`/samples/${id}/intervals/${interval}`, body)
        .then((res) => res.data.data),
    clone: (id: string) => api.post(`/samples/${id}/clone`),
    archive: (id: string) => api.post(`/samples/${id}/archive`),
    restore: (id: string) => api.post(`/samples/${id}/restore`),
  },
  categories: {
    list: (params: { page?: number; archived?: boolean; limit?: number }) =>
      list<Category>('/categories', params),
    create: (body: { name: string; description?: string }) => api.post('/categories', body),
    update: (id: string, body: Partial<{ name: string; description: string }>) =>
      api.patch(`/categories/${id}`, body),
    archive: (id: string) => api.post(`/categories/${id}/archive`),
    restore: (id: string) => api.post(`/categories/${id}/restore`),
    remove: (id: string) => api.delete(`/categories/${id}`),
  },
};
