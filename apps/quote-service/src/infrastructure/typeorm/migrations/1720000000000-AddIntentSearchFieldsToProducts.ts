import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntentSearchFieldsToProducts1720000000000 implements MigrationInterface {
  name = 'AddIntentSearchFieldsToProducts1720000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN "category" text,
        ADD COLUMN "keywords" text[] NOT NULL DEFAULT '{}',
        ADD COLUMN "tags" text[] NOT NULL DEFAULT '{}',
        ADD COLUMN "metadata" jsonb
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        DROP COLUMN "metadata",
        DROP COLUMN "tags",
        DROP COLUMN "keywords",
        DROP COLUMN "category"
    `);
  }
}
