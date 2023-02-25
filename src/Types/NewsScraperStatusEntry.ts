import { ProcessingStatusEnum } from './ProcessingStatusEnum';

export interface NewsScraperStatusEntry {
  status: ProcessingStatusEnum;
  lastUpdatedAt: Date | null;
  lastStartedAt: Date | null;
  lastCompletedAt: Date | null;
  lastFailedAt: Date | null;
  lastFailedErrorMessage: string | null;
}
