// Makes the gift QR code: a PNG that opens the live site.
// Run with: npm run qr
import { mkdir } from 'node:fs/promises';
import QRCode from 'qrcode';

const SITE = 'https://our-world-zenlovesjay.vercel.app';
const FILE = 'gift/our-little-world-qr.png';

await mkdir('gift', { recursive: true });
await QRCode.toFile(FILE, SITE, {
  width: 1200, // large enough to print crisply
  margin: 4,
  errorCorrectionLevel: 'M',
  color: { dark: '#1f4a17', light: '#ffffff' },
});
console.log(`Saved ${FILE} for ${SITE}`);
