// Loads the repository-root .env into process.env before any module that
// touches `env` (config/prisma, config/cache) is imported by the tests.
import '../src/config/dotenv';
