import { DataSource } from 'typeorm';

import { IS_DEVELOPMENT, POSTGRESQL_URL } from './Environment';

const dataSource = new DataSource({
  type: 'postgres',
  url: POSTGRESQL_URL,
  synchronize: IS_DEVELOPMENT,
  entities: ['src/Entities/*.ts'],
  migrations: ['src/Migrations/*.ts'],
});

export default dataSource;
