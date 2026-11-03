import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'

const envFile = process.env.PRISMA_ENV_FILE ?? '.env'
// override: the chosen file wins over vars already in the environment (e.g. exported in the shell),
// so db:migrate:prod can never end up targeting the dev database.
config({ path: envFile, override: true, quiet: true })

export default defineConfig({
  schema: 'src/db/',
  migrations: {
    path: 'src/db/migrations',
  },
  datasource: {
    // Not env(): `prisma generate` (postinstall) must work without a .env
    url: process.env.DIRECT_URL ?? '',
  },
})
