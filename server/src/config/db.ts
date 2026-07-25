import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  await mongoose.connect(env.MONGODB_URI);
  logger.info('MongoDB connected', { database: mongoose.connection.name });

  try {
    const { CategoryModel } = await import('../modules/categories/category.model');
    const categoriesWithoutColor = await CategoryModel.find({
      $or: [{ color: { $exists: false } }, { color: null }, { color: '' }, { color: '#475569' }],
    });
    if (categoriesWithoutColor.length > 0) {
      const PRESET_COLORS = [
        '#1d4ed8', // blue-700
        '#047857', // emerald-700
        '#4338ca', // indigo-700
        '#6b21a8', // purple-700
        '#be185d', // pink-700
        '#b91c1c', // red-700
        '#c2410c', // orange-700
        '#0f766e', // teal-700
        '#0369a1', // sky-700
        '#a21caf', // fuchsia-700
        '#78350f', // amber-900
        '#334155', // slate-700
      ];
      for (const cat of categoriesWithoutColor) {
        cat.color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)] || '#334155';
        await cat.save();
      }
      logger.info(`Assigned random colors to ${categoriesWithoutColor.length} existing categories`);
    }
  } catch (err) {
    logger.error('Failed to run category color migration', { error: err });
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB connection closed');
}
