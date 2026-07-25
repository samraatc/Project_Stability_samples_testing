export interface Product {
  _id: string;
  name: string;
  code: string;
  category: string;
  dosageForm: string;
  strength: string;
  storageConditions: string;
  description: string;
  isArchived: boolean;
  createdAt: string;
}

export interface Section {
  _id: string;
  name: string;
  description: string;
  isArchived: boolean;
}

export interface Category {
  _id: string;
  name: string;
  description: string;
  color: string;
  isArchived: boolean;
}

export interface Batch {
  _id: string;
  batchNo: string;
  batchCode: string;
  product: { _id: string; name: string; code: string } | string;
  manufacturingDate: string;
  notes: string;
}

export interface IntervalTest {
  interval: number;
  status: 'pending' | 'in_progress' | 'completed';
  reportName?: string;
  reportData?: string;
  testedAt?: string | null;
}

export interface Sample {
  _id: string;
  sampleCode: string;
  product: {
    _id: string;
    name: string;
    code: string;
    category?: string;
    storageConditions?: string;
  };
  batch: { _id: string; batchCode: string };
  section: { _id: string; name: string } | null;
  stabilityType: 'long-term' | 'accelerated' | 'intermediate';
  manufacturingDate: string;
  expiryDate: string | null;
  chargingDate: string;
  quantity: number;
  intervals: number[];
  intervalTests?: IntervalTest[];
  status: 'registered' | 'running' | 'completed';
  remarks: string;
  isArchived: boolean;
}

export const STABILITY_TYPES = ['long-term', 'accelerated', 'intermediate'] as const;
export const SAMPLE_STATUSES = ['registered', 'running', 'completed'] as const;
