import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  // CJS output: Prisma's generated client and pg resolve most reliably as CJS.
  format: ['cjs'],
  target: 'node22',
  clean: true,
  sourcemap: true,
  dts: false,
  outDir: 'dist',
  // Workspace packages export TypeScript source directly; bundle them in.
  noExternal: [/^@secureauthx\//],
  // Native/runtime deps stay external and resolve from node_modules.
  external: ['@prisma/client', 'dotenv', 'zod'],
});
