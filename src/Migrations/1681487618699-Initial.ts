import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1681487618699 implements MigrationInterface {
    name = 'Initial1681487618699'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."news_articles_multimediatype_enum" AS ENUM('text', 'video', 'audio')`);
        await queryRunner.query(`CREATE TABLE "news_articles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "url" character varying NOT NULL, "title" character varying NOT NULL, "multimediaType" "public"."news_articles_multimediatype_enum" NOT NULL, "content" character varying NOT NULL, "newsSiteArticleId" character varying NOT NULL, "authors" jsonb, "categories" jsonb, "imageUrl" character varying, "languageCode" character varying, "publishedAt" TIMESTAMP NOT NULL, "modifiedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ca1b67b1b6b2c382317bbd769dc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."scrape_runs_status_enum" AS ENUM('pending', 'processing', 'processed', 'failed')`);
        await queryRunner.query(`CREATE TABLE "scrape_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying NOT NULL, "status" "public"."scrape_runs_status_enum" NOT NULL DEFAULT 'pending', "arguments" jsonb, "hash" character varying, "failedErrorMessage" character varying, "startedAt" TIMESTAMP, "completedAt" TIMESTAMP, "failedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7c271a723ce0a12f57edc6ae720" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7ead2fa1301696b57c7a218e85" ON "scrape_runs" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_caa0e48e0ff76796a9a50fdea4" ON "scrape_runs" ("hash") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_caa0e48e0ff76796a9a50fdea4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7ead2fa1301696b57c7a218e85"`);
        await queryRunner.query(`DROP TABLE "scrape_runs"`);
        await queryRunner.query(`DROP TYPE "public"."scrape_runs_status_enum"`);
        await queryRunner.query(`DROP TABLE "news_articles"`);
        await queryRunner.query(`DROP TYPE "public"."news_articles_multimediatype_enum"`);
    }

}
