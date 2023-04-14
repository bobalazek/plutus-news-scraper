import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { NewsArticleAuthorType, NewsArticleCategoryType, NewsArticleType } from '../Schemas/NewsArticleSchema';
import { NewsArticleMultimediaTypeEnum } from '../Types/NewsArticleMultimediaTypeEnum';
import { IS_TEST } from '../Utils/Environment';

@Entity('news_articles')
export class NewsArticle implements NewsArticleType {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
  })
  url!: string;

  @Column({
    type: 'varchar',
  })
  title!: string;

  @Column({
    type: IS_TEST ? 'simple-enum' : 'enum',
    enum: NewsArticleMultimediaTypeEnum,
  })
  multimediaType!: NewsArticleMultimediaTypeEnum;

  @Column({
    type: 'varchar',
  })
  content!: string;

  @Column({
    type: 'varchar',
  })
  newsSiteArticleId!: string;

  @Column({ type: IS_TEST ? 'simple-json' : 'jsonb', nullable: true })
  authors?: NewsArticleAuthorType[] | null;

  @Column({ type: IS_TEST ? 'simple-json' : 'jsonb', nullable: true })
  categories?: NewsArticleCategoryType[] | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl?: string | null;

  @Column({ type: 'varchar', nullable: true })
  languageCode?: string | null;

  @Column({ type: IS_TEST ? 'datetime' : 'timestamp' })
  publishedAt!: Date;

  @Column({ type: IS_TEST ? 'datetime' : 'timestamp' })
  modifiedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
