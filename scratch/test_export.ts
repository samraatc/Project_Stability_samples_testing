import mongoose from 'mongoose';
import { connectDatabase } from '../server/src/config/db';
import { StabilitySampleModel } from '../server/src/modules/samples/sample.model';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatMMM_YYYY = (dateStr: any) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${months[d.getMonth()]}/${d.getFullYear()}`;
};

const formatDD_MM_YYYY = (dateStr: any) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatMMM_YYYY_Space = (dateStr: any) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
};

const calculateTargetPullDate = (chargingDateStr: string, intervalMonth: number) => {
  const d = new Date(chargingDateStr);
  d.setMonth(d.getMonth() + intervalMonth);
  return formatMMM_YYYY_Space(d);
};

async function testExport() {
  await connectDatabase();
  console.log('Connected to DB!');

  const samples = await StabilitySampleModel.find({ isDeleted: false })
    .populate('product')
    .populate('batch')
    .lean();

  console.log(`Total samples: ${samples.length}`);

  samples.forEach((s: any, idx) => {
    try {
      console.log(`Processing sample ${idx}: ${s.sampleCode}`);

      // Simulate export logic
      const intervalValues = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map((m) => {
        if (s.intervals && s.intervals.includes(m)) {
          return calculateTargetPullDate(s.chargingDate, m);
        }
        return '';
      });

      const row = [
        s.product?.category || '',
        s.product?.name || '',
        s.batch?.batchNo || s.batch?.batchCode || '',
        s.sampleCode,
        s.stabilityType,
        s.quantity,
        formatMMM_YYYY(s.manufacturingDate),
        formatMMM_YYYY(s.expiryDate),
        formatDD_MM_YYYY(s.chargingDate),
        ...intervalValues,
        s.status,
        s.remarks || '',
      ];

      console.log(`  Row ${idx} success! Code: ${s.sampleCode}`);
    } catch (err: any) {
      console.error(`  CRASH on sample ${s.sampleCode}:`, err.message);
    }
  });

  await mongoose.disconnect();
}

testExport().catch(console.error);
