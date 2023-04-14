import { join } from 'path';
import { DataSource } from 'typeorm';

import { IS_DEVELOPMENT, POSTGRESQL_URL } from './Environment';
import { ROOT_DIRECTORY } from './Paths';

const dataSource = new DataSource({
  type: 'postgres',
  url: POSTGRESQL_URL,
  synchronize: IS_DEVELOPMENT,
  entities: [join(ROOT_DIRECTORY, 'Entities', '*.{ts,js}')],
  migrations: [join(ROOT_DIRECTORY, 'Migrations', '*.{ts,js}')],
});

export default dataSource;
