import type { ShreniLevelItem } from '@/lib/constants/industry-types';

export type { ShreniLevelItem };

export interface ShreniLevelFormData {
  code: string;
  name: string;
  levelNumber: number;
  labelNepali: string;
  description?: string;
  minSalary?: number;
  maxSalary?: number;
  rankOrder?: number;
  isActive?: boolean;
}

export interface ShreniLevelWriteResult {
  success: boolean;
  data?: ShreniLevelItem;
  error?: string;
}
