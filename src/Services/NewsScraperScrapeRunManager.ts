import { inject, injectable } from 'inversify';
import { DeepPartial, Repository } from 'typeorm';

import { CONTAINER_TYPES } from '../DI/ContainerTypes';
import { ScrapeRun } from '../Entities/ScrapeRun';
import { ProcessingStatusEnum } from '../Types/ProcessingStatusEnum';
import { generateHash } from '../Utils/Helpers';
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

  async getAllNewestGroupByHash(type: string) {
    const repository = await this.getRepository();

    return repository
      .createQueryBuilder('scrapeRun')
      .select('scrapeRun.status')
      .addSelect('scrapeRun.arguments')
      .addSelect('scrapeRun.createdAt')
      .addSelect('scrapeRun.updatedAt')
      .where('scrapeRun.type = :type', { type })
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('MAX(innerScrapeRun.createdAt)')
          .from('scrape_runs', 'innerScrapeRun')
          .where('innerScrapeRun.hash = scrapeRun.hash')
          .andWhere('innerScrapeRun.type = :type')
          .getQuery();
        return 'scrapeRun.createdAt = ' + subQuery;
      })
      .orderBy('scrapeRun.updatedAt', 'ASC')
      .getMany();
  }

  async getAllPendingAndProcessing(type: string, newsSite: string, urls: string[]) {
    const repository = await this.getRepository();

    const hashes = urls.map((url) => {
      return generateHash({ queue: type, newsSite, url });
    });

    return repository
      .createQueryBuilder('scrapeRun')
      .select('scrapeRun.status')
      .addSelect('scrapeRun.arguments')
      .addSelect('scrapeRun.createdAt')
      .addSelect('scrapeRun.updatedAt')
      .where('scrapeRun.type = :type', { type })
      .andWhere('scrapeRun.status IN (:...statuses)', {
        statuses: [ProcessingStatusEnum.PENDING, ProcessingStatusEnum.PROCESSING],
      })
      .andWhere('scrapeRun.hash IN (:...hashes)', { hashes })
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('MAX(innerScrapeRun.createdAt)')
          .from('scrape_runs', 'innerScrapeRun')
          .where('innerScrapeRun.hash = scrapeRun.hash')
          .andWhere('innerScrapeRun.type = :type')
          .andWhere('innerScrapeRun.status IN (:...statuses)')
          .andWhere('innerScrapeRun.hash IN (:...hashes)')
          .getQuery();
        return 'scrapeRun.createdAt = ' + subQuery;
      })
      .orderBy('scrapeRun.updatedAt', 'ASC')
      .getMany();
  }

  async getAllStuck(type: string, timeoutInSeconds: number) {
    const repository = await this.getRepository();

    return repository
      .createQueryBuilder('scrapeRun')
      .where('scrapeRun.type = :type', { type })
      .andWhere('scrapeRun.status IN (:...statuses)', {
        statuses: [ProcessingStatusEnum.PENDING, ProcessingStatusEnum.PROCESSING],
      })
      .andWhere('scrapeRun.updatedAt < :updatedAt', {
        updatedAt: new Date(new Date().getTime() - 1000 * timeoutInSeconds),
      })
      .getMany();
  }

  async create(scrapeRun: DeepPartial<ScrapeRun>) {
    const repository = await this.getRepository();

    const hash =
      typeof scrapeRun.arguments?.newsSite === 'string'
        ? generateHash({ queue: scrapeRun.type as string, newsSite: scrapeRun.arguments.newsSite })
        : undefined;

    return repository.create({ ...scrapeRun, hash });
  }

  async save(scrapeRun: ScrapeRun | ScrapeRun[]) {
    const repository = await this.getRepository();

    return repository.save(Array.isArray(scrapeRun) ? scrapeRun : [scrapeRun]);
  }

  async getRepository() {
    if (!this._scrapeRunRepository) {
      const dataSource = await this._newsScraperDatabase.getDataSource();
      this._scrapeRunRepository = dataSource.getRepository(ScrapeRun);
    }

    return this._scrapeRunRepository;
  }
}
