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

export const DEFAULT_INTERVALS_BY_TYPE: Record<string, number[]> = {
  'long-term': [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  'intermediate': [3, 6, 9, 12],
  'accelerated': [1, 2, 3, 6],
};

export const STABILITY_TYPE_INFO: Record<
  string,
  {
    title: string;
    condition: string;
    description: string;
    defaultIntervals: number[];
    period: string;
    ichGuideline: string;
  }
> = {
  'long-term': {
    title: 'Long-Term Stability Study',
    condition: '25°C ± 2°C / 60% RH ± 5% RH',
    description:
      'Real-time stability testing conducted over the intended shelf-life of the product under ambient storage conditions.',
    defaultIntervals: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
    period: '3m – 36m+ (Up to 36+ Months)',
    ichGuideline:
      'ICH Q1A(R2): Testing frequency every 3 months for 1st year, 6 months for 2nd year, and annually thereafter.',
  },
  'intermediate': {
    title: 'Intermediate Stability Study',
    condition: '30°C ± 2°C / 65% RH ± 5% RH',
    description:
      'Conducted when significant change occurs during accelerated testing, evaluated up to 12 months.',
    defaultIntervals: [3, 6, 9, 12],
    period: '3m – 12m (Up to 12 Months)',
    ichGuideline: 'ICH Q1A(R2): Minimum 4 time points including initial and final (3, 6, 9, 12 months).',
  },
  'accelerated': {
    title: 'Accelerated Stability Study',
    condition: '40°C ± 2°C / 75% RH ± 5% RH',
    description:
      'Exposes product to exaggerated storage conditions to evaluate degradation rates and predict shelf-life rapidly.',
    defaultIntervals: [1, 2, 3, 6],
    period: '1m – 6m (Up to 6 Months)',
    ichGuideline: 'ICH Q1A(R2): Minimum time points including 1, 2, 3, 6 months.',
  },
};

export function isSampleFullyCompleted(sample: {
  status?: string;
  intervals?: number[];
  intervalTests?: IntervalTest[];
}): boolean {
  if (sample.status === 'completed') return true;
  if (
    sample.intervals &&
    sample.intervals.length > 0 &&
    sample.intervalTests &&
    sample.intervalTests.length > 0
  ) {
    const tests = sample.intervalTests;
    return sample.intervals.every((m) => {
      const test = tests.find((t) => t.interval === m);
      return Boolean(test && test.status === 'completed');
    });
  }
  return false;
}
