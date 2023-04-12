import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { ProcessingStatusEnum } from '../Types/ProcessingStatusEnum';
import { IS_TEST } from '../Utils/Environment';

@Entity('scrape_runs')
export class ScrapeRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({
    type: 'varchar',
  })
  type!: string;

  @Column({
    type: IS_TEST ? 'simple-enum' : 'enum',
    enum: ProcessingStatusEnum,
    default: ProcessingStatusEnum.PENDING,
  })
  status!: ProcessingStatusEnum;

  @Column({
    type: IS_TEST ? 'simple-json' : 'json',
    nullable: true,
  })
  arguments?: Record<string, string | number | null> | null;

  @Index()
  @Column({
    type: 'varchar',
    nullable: true,
  })
  hash?: string | null;

  @Column({ type: 'varchar', nullable: true })
  failedErrorMessage?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  failedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
