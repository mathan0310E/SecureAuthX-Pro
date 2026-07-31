import 'dotenv/config';
import { generateTotp } from '@secureauthx/security';

const secret = process.argv[2];
if (!secret) {
  console.error('usage: tsx scripts/totp-now.ts <secret>');
  process.exit(1);
}
console.log(generateTotp(secret));
