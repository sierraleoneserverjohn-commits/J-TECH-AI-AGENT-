import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'assets');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Full icon SVG (512x512)
const fullSvg = fs.readFileSync(path.join(rootDir, 'src', 'assets', 'logo.svg'), 'utf8');

// Foreground SVG for Android adaptive icon: transparent background, glowing ring + J + orb
const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="cyanEnergy" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f3ff"/>
      <stop offset="50%" stop-color="#00a8ff"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="30%" stop-color="#67e8f9"/>
      <stop offset="70%" stop-color="#00f3ff"/>
      <stop offset="100%" stop-color="#0066cc" stop-opacity="0.2"/>
    </radialGradient>
    <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur1"/>
      <feGaussianBlur stdDeviation="18" result="blur2"/>
      <feMerge>
        <feMergeNode in="blur2"/>
        <feMergeNode in="blur1"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="orbPulse" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="12" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Scale slightly inside safe zone of adaptive icon -->
  <g transform="translate(40, 40) scale(0.84)">
    <circle cx="256" cy="256" r="216" fill="none" stroke="#00f3ff" stroke-width="1.5" stroke-opacity="0.25" stroke-dasharray="6 8"/>
    <circle cx="256" cy="256" r="186" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.3"/>
    <circle cx="256" cy="256" r="156" fill="none" stroke="url(#cyanEnergy)" stroke-width="16" stroke-linecap="round" filter="url(#neonGlow)"/>
    <path d="M 296 148 L 296 308 C 296 358 262 384 218 384 C 182 384 156 362 148 334" fill="none" stroke="url(#cyanEnergy)" stroke-width="20" stroke-linecap="round" filter="url(#neonGlow)"/>
    <path d="M 264 148 L 328 148" fill="none" stroke="#ffffff" stroke-width="16" stroke-linecap="round" filter="url(#neonGlow)"/>
    <circle cx="220" cy="240" r="34" fill="url(#orbGlow)" filter="url(#orbPulse)"/>
    <circle cx="220" cy="240" r="14" fill="#ffffff"/>
    <circle cx="390" cy="200" r="7" fill="#00f3ff" filter="url(#neonGlow)"/>
    <circle cx="120" cy="290" r="6" fill="#38bdf8" filter="url(#neonGlow)"/>
    <circle cx="256" cy="100" r="5" fill="#67e8f9" filter="url(#neonGlow)"/>
  </g>
</svg>`;

async function generate() {
  console.log('[make-icons] Generating JEXA app icons and splash screens...');

  // 1. icon-only.png (1024x1024)
  await sharp(Buffer.from(fullSvg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'icon-only.png'));
  console.log('✓ assets/icon-only.png (1024x1024)');

  // 2. icon-foreground.png (1024x1024) - transparent background
  await sharp(Buffer.from(foregroundSvg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'icon-foreground.png'));
  console.log('✓ assets/icon-foreground.png (1024x1024)');

  // 3. icon-background.png (1024x1024) - deep navy #05080f
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 5, g: 8, b: 15, alpha: 1 },
    },
  })
    .png()
    .toFile(path.join(assetsDir, 'icon-background.png'));
  console.log('✓ assets/icon-background.png (1024x1024)');

  // 4. splash.png (2732x2732) and splash-dark.png (2732x2732)
  // Deep navy canvas with centered 800x800 logo
  const logoResized = await sharp(Buffer.from(fullSvg))
    .resize(800, 800)
    .png()
    .toBuffer();

  const splashBase = sharp({
    create: {
      width: 2732,
      height: 2732,
      channels: 4,
      background: { r: 5, g: 8, b: 15, alpha: 1 },
    },
  }).composite([
    {
      input: logoResized,
      gravity: 'centre',
    },
  ]);

  await splashBase.clone().png().toFile(path.join(assetsDir, 'splash.png'));
  console.log('✓ assets/splash.png (2732x2732)');

  await splashBase.clone().png().toFile(path.join(assetsDir, 'splash-dark.png'));
  console.log('✓ assets/splash-dark.png (2732x2732)');

  console.log('[make-icons] All icon assets generated successfully.');
}

generate().catch((err) => {
  console.error('[make-icons] Error generating icons:', err);
  process.exit(1);
});
