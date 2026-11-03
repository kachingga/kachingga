import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'

const envFile = process.env.PRISMA_ENV_FILE ?? '.env'
config({ path: envFile })

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
