import { DataSource } from 'typeorm';

import { IS_DEVELOPMENT, POSTGRESQL_URL } from './Utils/Environment';

export default new DataSource({
  type: 'postgres',
  url: POSTGRESQL_URL,
  synchronize: IS_DEVELOPMENT,
  entities: ['src/Entities/*.ts'],
  migrations: ['src/Migrations/*.ts'],
});
