import { inject, injectable } from 'inversify';
import { DeepPartial, Repository } from 'typeorm';

import { CONTAINER_TYPES } from '../DI/ContainerTypes';
import { ScrapeRun } from '../Entitites/ScrapeRun';
import { NewsScraperMessageBrokerQueuesEnum } from '../Types/NewsMessageBrokerQueues';
import { getHashForNewsSiteAndQueue } from '../Utils/Helpers';
import { NewsScraperDatabase } from './NewsScraperDatabase';

@injectable()
export class NewsScraperScrapeRunManager {
  private _scrapeRunRepository?: Repository<ScrapeRun>;

  constructor(@inject(CONTAINER_TYPES.NewsScraperDatabase) private _newsScraperDatabase: NewsScraperDatabase) {}

  async getById(id: string) {
    const repository = await this.getRepository();

    return repository.findOneBy({
      id,
    });
  }

  async getLastRunsByType(type: string) {
    const repository = await this.getRepository();

    return repository
      .createQueryBuilder('scrapeRun')
      .select('scrapeRun.status')
      .addSelect('scrapeRun.arguments')
      .addSelect('MAX(scrapeRun.createdAt)')
      .distinct(true)
      .where('scrapeRun.type = :type')
      .setParameters({
        type,
      })
      .orderBy('scrapeRun.updatedAt', 'ASC')
      .groupBy('scrapeRun.hash')
      .getMany();
  }

  async create(scrapeRun: DeepPartial<ScrapeRun>) {
    const repository = await this.getRepository();

    const hash =
      typeof scrapeRun.arguments?.newsSite === 'string'
        ? getHashForNewsSiteAndQueue(scrapeRun.arguments.newsSite, scrapeRun.type as NewsScraperMessageBrokerQueuesEnum)
        : undefined;

    return repository.create({ ...scrapeRun, hash });
  }

  async save(scrapeRun: ScrapeRun) {
    const repository = await this.getRepository();

    return repository.save(scrapeRun);
  }

  async getRepository() {
    if (!this._scrapeRunRepository) {
      const dataSource = await this._newsScraperDatabase.getDataSource();
      this._scrapeRunRepository = dataSource.getRepository(ScrapeRun);
    }

    return this._scrapeRunRepository;
  }
}
