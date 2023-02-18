import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { NewsArticleAuthorType, NewsArticleCategoryType, NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';

@Entity('news_articles')
export class NewsArticle extends BaseEntity implements NewsArticleType {
  @PrimaryGeneratedColumn('uuid')
  id!: number;

  @Column()
  url!: string;

  @Column()
  title!: string;

  @Column({
    type: 'enum',
    enum: NewsArticleMultimediaTypeEnum,
  })
  multimediaType!: NewsArticleMultimediaTypeEnum;

  @Column()
  content!: string;

  @Column()
  newsSiteArticleId!: string;

  @Column({ type: 'jsonb', nullable: true })
  authors?: NewsArticleAuthorType[];

  @Column({ type: 'jsonb', nullable: true })
  categories?: NewsArticleCategoryType[];

  @Column({ nullable: true })
  imageUrl?: string;

  @Column({ nullable: true })
  languageCode?: string;

  @Column()
  publishedAt!: Date;

  @Column()
  modifiedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
