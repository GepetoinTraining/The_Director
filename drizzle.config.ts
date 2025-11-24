import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite', // <--- Use 'dialect' instead of 'driver'
  dbCredentials: {
    url: './data/director.db',
  },
});