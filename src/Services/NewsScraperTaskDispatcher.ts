import { inject, injectable } from 'inversify';

import { CONTAINER_TYPES } from '../DI/ContainerTypes';
import { ScrapeRun } from '../Entities/ScrapeRun';
import { NewsMessageBrokerQueuesDataType, NewsScraperMessageBrokerQueuesEnum } from '../Types/NewsMessageBrokerQueues';
import { NewsScraperInterface } from '../Types/NewsScraperInterface';
import { ProcessingStatusEnum } from '../Types/ProcessingStatusEnum';
import { LOKI_PINO_BATCH_INTERVAL_SECONDS } from '../Utils/Environment';
import { sleep } from '../Utils/Helpers';
import { HTTPServerService } from './HTTPServerService';
import { Logger } from './Logger';
import { NewsScraperDatabase } from './NewsScraperDatabase';
import { NewsScraperManager } from './NewsScraperManager';
import { NewsScraperMessageBroker } from './NewsScraperMessageBroker';
import { NewsScraperScrapeRunManager } from './NewsScraperScrapeRunManager';
import { PrometheusService } from './PrometheusService';

const queue = NewsScraperMessageBrokerQueuesEnum.NEWS_SCRAPER_RECENT_ARTICLES_SCRAPE_QUEUE;

@injectable()
export class NewsScraperTaskDispatcher {
  private _httpServerPort?: number;

  private _newsScrapers: NewsScraperInterface[] = [];
  private _scrapeInterval: number = 30 * 1000;
  private _messageQueuesMonitoringInterval: number = 5 * 1000;
  private _scrapeRecentArticlesExpirationTime: number = 180 * 1000; // After how long do we want to expire this message?

  private _dispatchRecentArticlesScrapeIntervalTimer?: ReturnType<typeof setInterval>;
  private _messageQueuesMonitoringIntervalTimer?: ReturnType<typeof setInterval>;

  constructor(
    @inject(CONTAINER_TYPES.Logger) private _logger: Logger,
    @inject(CONTAINER_TYPES.NewsScraperManager) private _newsScraperManager: NewsScraperManager,
    @inject(CONTAINER_TYPES.NewsScraperMessageBroker) private _newsScraperMessageBroker: NewsScraperMessageBroker,
    @inject(CONTAINER_TYPES.NewsScraperDatabase) private _newsScraperDatabase: NewsScraperDatabase,
    @inject(CONTAINER_TYPES.NewsScraperScrapeRunManager)
    private _newsScraperScrapeRunManager: NewsScraperScrapeRunManager,
    @inject(CONTAINER_TYPES.HTTPServerService) private _httpServerService: HTTPServerService,
    @inject(CONTAINER_TYPES.PrometheusService) private _prometheusService: PrometheusService
  ) {}

  async start(httpServerPort?: number) {
    this._httpServerPort = httpServerPort;

    this._logger.info(`========== Starting the task dispatcher ... ==========`);

    this._registerTerminate();

    await this._registerMetrics();

    this._startRecentArticlesScrape();
    this._startMessageQueuesMonitoring();

    await new Promise(() => {
      // Together forever and never apart ...
    });
  }

  async terminate(errorMessage?: string) {
    if (errorMessage) {
      this._logger.error(`Terminating news scraper task dispatcher with error: ${errorMessage}`);
    } else {
      this._logger.info(`Terminating news scraper task dispatcher`);
    }

    clearInterval(this._dispatchRecentArticlesScrapeIntervalTimer);
    clearInterval(this._messageQueuesMonitoringIntervalTimer);

    await this._httpServerService.terminate();
    await this._newsScraperDatabase.terminate();

    await this._newsScraperMessageBroker.terminate();

    // Make sure we give out logger enough time to send the last batch of logs
    await sleep(LOKI_PINO_BATCH_INTERVAL_SECONDS * 1000 * 1.2 /* a bit of buffer accounting for network latency */);

    process.exit(errorMessage ? 1 : 0);
  }

  /**
   * Technically this method is private, but we use them in our tests, so do NOT set them to private!
   * @param returnOnlyNonPending - If true, we will return only scrapers that are neither pending nor processing. Otherwise, if will also return the pending once
   */
  async _getSortedScrapersAndRuns(returnOnlyNonPending: boolean = false) {
    const scrapersAndRuns: { scraper: NewsScraperInterface; scrapeRun: ScrapeRun | null; isDone: boolean }[] = [];

    const lastScrapeRuns = await this._newsScraperScrapeRunManager.getAllNewestGroupByHash(queue);

    const scrapeRunsscraperKeys = lastScrapeRuns.map((scrapeRun) => {
      return scrapeRun.arguments?.newsSite;
    });

    const newsScrapers = await this._getNewsScrapers();
    const newsScrapersMap = new Map<string, NewsScraperInterface>(
      newsScrapers.map((newsScraper) => {
        return [newsScraper.key, newsScraper];
      })
    );

    if (newsScrapers.length > 0) {
      for (const newsScraper of newsScrapers) {
        if (scrapeRunsscraperKeys.includes(newsScraper.key)) {
          continue;
        }

        scrapersAndRuns.push({ scraper: newsScraper, scrapeRun: null, isDone: false });
      }
    }

    for (const lastScrapeRun of lastScrapeRuns) {
      if (lastScrapeRun.status === ProcessingStatusEnum.PROCESSING) {
        continue;
      }

      if (returnOnlyNonPending && lastScrapeRun.status === ProcessingStatusEnum.PENDING) {
        continue;
      }

      const newsSiteKey = typeof lastScrapeRun.arguments?.newsSite === 'string' ? lastScrapeRun.arguments.newsSite : '';
      const newsScraper = newsScrapersMap.get(newsSiteKey);
      if (!newsScraper) {
        continue;
      }

      scrapersAndRuns.push({
        scraper: newsScraper,
        scrapeRun: lastScrapeRun,
        isDone: [ProcessingStatusEnum.FAILED, ProcessingStatusEnum.PROCESSED].includes(lastScrapeRun.status),
      });
    }

    return scrapersAndRuns;
  }

  async _getNewsScrapers() {
    if (this._newsScrapers.length === 0) {
      this._newsScrapers = await this._newsScraperManager.getAll();
    }

    return this._newsScrapers;
  }

  private async _startRecentArticlesScrape() {
    await this._checkForStuckScrapeRuns();
    this._dispatchRecentArticlesScrape(true);

    this._dispatchRecentArticlesScrapeIntervalTimer = setInterval(async () => {
      await this._checkForStuckScrapeRuns();
      this._dispatchRecentArticlesScrape();
    }, this._scrapeInterval);
  }

  private _startMessageQueuesMonitoring() {
    this._messageQueuesMonitoringIntervalTimer = setInterval(async () => {
      const messagesCountMap = await this._newsScraperMessageBroker.getMessageCountInAllQueues();

      this._logger.info(`Messages count map: ${JSON.stringify(messagesCountMap)}`);
    }, this._messageQueuesMonitoringInterval);
  }

  private _registerTerminate() {
    process.on('SIGTERM', async () => {
      await this.terminate();
    });

    process.on('uncaughtException', async (err) => {
      await this.terminate(`UncaughtException: ${err.message}; Stack: ${err.stack}`);
    });
  }

  private async _registerMetrics() {
    this._prometheusService.addDefaultMetrics({ prefix: `news_scraper_task_dispatcher_` });

    if (this._httpServerPort) {
      await this._httpServerService.start(this._httpServerPort, () => {
        this._prometheusService.addMetricsEndpointToExpressApp(this._httpServerService.getExpressApp());
      });
    }
  }

  private async _dispatchRecentArticlesScrape(isInitialCheck: boolean = false) {
    this._logger.info(`Dispatch news article events for scrapers ...`);

    // For the initial check, we always want to dispatch events for all scrapers,
    // even if they are pending, so they can be added to the queue and processed
    const scrapersAndRuns = await this._getSortedScrapersAndRuns(!isInitialCheck);
    if (scrapersAndRuns.length === 0) {
      this._logger.info(`No scrapers found to add to queue. Skipping ...`);

      return;
    }

    for (const scraperAndRun of scrapersAndRuns) {
      this._logger.debug(`Dispatching events for ${scraperAndRun.scraper.key} ...`);

      let args: NewsMessageBrokerQueuesDataType[typeof queue] = {
        newsSite: scraperAndRun.scraper.key,
      };

      let scrapeRunId = scraperAndRun.scrapeRun?.id ?? undefined;
      if (!scraperAndRun.scrapeRun || scraperAndRun.isDone) {
        this._logger.debug(
          `No pending or processing scrape run not found in database yet. Creating one (${JSON.stringify(args)}) ...`
        );

        // This is mostly needed for the initial check, so we can add all scrapers to the queue,
        // without also creating a new database entry for them
        const scrapeRun = await this._newsScraperScrapeRunManager.create({
          type: queue,
          status: ProcessingStatusEnum.PENDING,
          arguments: args,
        });
        await this._newsScraperScrapeRunManager.save(scrapeRun);

        scrapeRunId = scrapeRun.id;
      }

      args = {
        ...args,
        scrapeRunId: scrapeRunId,
      };

      await this._newsScraperMessageBroker.sendToQueue(
        queue,
        args,
        { expiration: this._scrapeRecentArticlesExpirationTime, persistent: true },
        { durable: true }
      );
    }
  }

  private async _checkForStuckScrapeRuns() {
    this._logger.info(`Checking for stuck scrape runs ...`);

    const scrapeStuckTime = this._scrapeRecentArticlesExpirationTime;
    const stuckScrapeRuns = await this._newsScraperScrapeRunManager.getAllStuck(queue, scrapeStuckTime);
    if (stuckScrapeRuns.length === 0) {
      this._logger.info(`No stuck scrape runs at the moment. Skipping ...`);

      return;
    }

    this._logger.info(`Found ${stuckScrapeRuns.length} stuck scrape runs`);

    for (const stuckScrapeRun of stuckScrapeRuns) {
      this._logger.info(`Marking scrape run ${stuckScrapeRun.id} as failed ...`);

      stuckScrapeRun.status = ProcessingStatusEnum.FAILED;
      stuckScrapeRun.failedAt = new Date();
      stuckScrapeRun.failedErrorMessage = `Stuck for more than ${scrapeStuckTime / 1000} seconds`;
      await this._newsScraperScrapeRunManager.save(stuckScrapeRun);
    }
  }
}
