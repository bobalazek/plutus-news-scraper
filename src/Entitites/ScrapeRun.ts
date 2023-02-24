import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { LifecycleStatusEnum } from '../Types/LifecycleStatusEnum';

@Entity('scrape_runs')
export class ScrapeRun {
  @PrimaryGeneratedColumn('uuid')
  id!: number;

  @Index()
  @Column()
  type!: string;

  @Column({
    type: 'enum',
    enum: LifecycleStatusEnum,
  })
  status!: LifecycleStatusEnum;

  @Column({
    type: 'json',
    nullable: true,
  })
  arguments?: Record<string, string | number | null>;

  @Index()
  @Column({
    nullable: true,
  })
  hash?: string;

  @Column({ nullable: true })
  failedErrorMessage?: string;

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  @Column({ nullable: true })
  failedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
