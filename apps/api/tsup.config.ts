import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  // CJS output: several runtime deps (jsonwebtoken, nodemailer, winston)
  // use dynamic require() which ESM bundles cannot satisfy reliably.
  format: ['cjs'],
  target: 'node22',
  clean: true,
  sourcemap: true,
  dts: false,
  outDir: 'dist',
  // Workspace packages export TypeScript source directly; bundle them in.
  noExternal: [/^@secureauthx\//],
  // Native/runtime deps stay external and resolve from node_modules.
  external: [
    '@prisma/client',
    'bcrypt',
    'ioredis',
    'dotenv',
    'zod',
    'express',
    'jsonwebtoken',
  ],
});
