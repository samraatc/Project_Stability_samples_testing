import mongoose from 'mongoose';
import { connectDatabase } from '../server/src/config/db';
import { StabilitySampleModel } from '../server/src/modules/samples/sample.model';

async function check() {
  await connectDatabase();
  console.log('Database connected!');

  const pipeline = [
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        as: 'productInfo',
      },
    },
    { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'batches',
        localField: 'batch',
        foreignField: '_id',
        as: 'batchInfo',
      },
    },
    { $unwind: { path: '$batchInfo', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'sections',
        localField: 'section',
        foreignField: '_id',
        as: 'sectionInfo',
      },
    },
    { $unwind: { path: '$sectionInfo', preserveNullAndEmptyArrays: true } },
    { $match: { isDeleted: false, isArchived: false } },
  ];

  const items = await StabilitySampleModel.aggregate(pipeline).exec();
  console.log('Number of aggregated samples:', items.length);
  if (items.length > 0) {
    const mapped = items.map((item) => ({
      ...item,
      product: item.productInfo || null,
      batch: item.batchInfo || null,
      section: item.sectionInfo || null,
      productInfo: undefined,
      batchInfo: undefined,
      sectionInfo: undefined,
    }));
    console.log('Aggregated Sample 0:', JSON.stringify(mapped[0], null, 2));
  }
  await mongoose.disconnect();
}

check().catch(console.error);
