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
    type: IS_TEST ? 'simple-json' : 'jsonb',
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

  @Column({ type: IS_TEST ? 'datetime' : 'timestamp with time zone', nullable: true })
  startedAt?: Date | null;

  @Column({ type: IS_TEST ? 'datetime' : 'timestamp with time zone', nullable: true })
  completedAt?: Date | null;

  @Column({ type: IS_TEST ? 'datetime' : 'timestamp with time zone', nullable: true })
  failedAt?: Date | null;

  @CreateDateColumn({ type: IS_TEST ? 'datetime' : 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: IS_TEST ? 'datetime' : 'timestamp with time zone' })
  updatedAt!: Date;
}
