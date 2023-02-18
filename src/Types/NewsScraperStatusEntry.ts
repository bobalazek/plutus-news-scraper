import { ProcessingStatusEnum } from './ProcessingStatusEnum';

export interface NewsScraperStatusEntry {
  status: ProcessingStatusEnum;
  lastUpdate: Date | null;
  lastStarted: Date | null;
  lastProcessed: Date | null;
  lastFailed: Date | null;
  lastFailedErrorMessage: string | null;
}
