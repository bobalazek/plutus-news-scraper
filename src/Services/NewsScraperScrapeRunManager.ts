import { inject, injectable } from 'inversify';
import { DeepPartial, Repository } from 'typeorm';

import { CONTAINER_TYPES } from '../DI/ContainerTypes';
import { ScrapeRun } from '../Entitites/ScrapeRun';
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

  async getAllPendingAndProcessing(type: string, newsSite: string, urls: string[]) {
    const repository = await this.getRepository();

    const hashes = urls.map((url) => {
      return generateHash({ queue: type, newsSite, url });
    });

    // TODO: also make sure we ignore scrape runs that seem stuck like if it's still ending or processing
    // for more than an hour or so

    return repository
      .createQueryBuilder('scrapeRun')
      .select('scrapeRun.status')
      .addSelect('scrapeRun.arguments')
      .addSelect('MAX(scrapeRun.createdAt)')
      .distinct(true)
      .where('scrapeRun.type = :type AND scrapeRun.status IN :statuses AND scrapeRun.hash IN :hashes')
      .setParameters({
        type,
        statuses: [ProcessingStatusEnum.PENDING, ProcessingStatusEnum.PROCESSING],
        hashes,
      })
      .orderBy('scrapeRun.updatedAt', 'ASC')
      .groupBy('scrapeRun.hash')
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
