import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('EaseLand Info Pages Dynamic Viewport Hero Sizing Suite', () => {
  const pages = [
    { name: 'BuyInfoPage.jsx', file: 'BuyInfoPage.jsx', image: 'buy_hero_transparent.png' },
    { name: 'RentInfoPage.jsx', file: 'RentInfoPage.jsx', image: 'rent_hero_transparent.png' },
    { name: 'SellInfoPage.jsx', file: 'SellInfoPage.jsx', image: 'sell_hero_transparent.png' }
  ];

  it('1. Verifies index.css defines info-hero-dynamic class with mobile top and bottom navbar offsets', () => {
    const cssPath = path.join(rootDir, 'src', 'index.css');
    assert.ok(fs.existsSync(cssPath), 'index.css must exist');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssContent.includes('.info-hero-dynamic'), 'index.css must define .info-hero-dynamic class');
    assert.ok(cssContent.includes('height: calc(100dvh - 8rem)'), 'info-hero-dynamic must calculate height minus 8rem (top 4rem + bottom 4rem)');
    assert.ok(cssContent.includes('env(safe-area-inset-bottom'), 'info-hero-dynamic must support safe-area-inset-bottom');
    assert.ok(cssContent.includes('height: calc(100dvh - 9rem)'), 'info-hero-dynamic must support sm tablet at 9rem offset');
    assert.ok(cssContent.includes('height: calc(100dvh - 5rem)'), 'info-hero-dynamic must support md tablet where bottom nav is hidden');
    assert.ok(cssContent.includes('min-height: auto'), 'info-hero-dynamic must revert to auto height on desktop');
  });

  it('2. Verifies PwaUpdatePrompt is positioned below navbar and never covered', () => {
    const pwaPromptPath = path.join(rootDir, 'src', 'components', 'PwaUpdatePrompt.jsx');
    assert.ok(fs.existsSync(pwaPromptPath), 'PwaUpdatePrompt.jsx must exist');
    const content = fs.readFileSync(pwaPromptPath, 'utf8');

    assert.ok(content.includes('top-20 sm:top-24'), 'PwaUpdatePrompt must sit below mobile (64px) and desktop (80px) navbar');
    assert.ok(content.includes('z-[100]'), 'PwaUpdatePrompt must have higher z-index than navbar');
    assert.ok(content.includes('left-4 right-4 sm:left-auto sm:right-6'), 'PwaUpdatePrompt must have responsive horizontal padding');
  });

  pages.forEach(({ name, file, image }) => {
    it('3. Verifies ' + name + ' uses dynamic viewport hero container and responsive dvh image sizing', () => {
      const filePath = path.join(rootDir, 'src', 'pages', file);
      assert.ok(fs.existsSync(filePath), file + ' must exist');
      const content = fs.readFileSync(filePath, 'utf8');

      // Check dynamic viewport hero container class
      assert.ok(content.includes('info-hero-dynamic'), file + ' must use info-hero-dynamic class');

      // Check inner flex layout for dynamic viewport vertical space distribution
      assert.ok(content.includes('flex-1 w-full flex flex-col justify-between lg:grid lg:grid-cols-12'), file + ' must distribute height dynamically with flexbox on mobile');

      // Check responsive headline size
      assert.ok(content.includes('text-lg xs:text-xl sm:text-3xl lg:text-5xl'), file + ' must use responsive headline on mobile');

      // Check subtitle mobile line-clamp
      assert.ok(content.includes('line-clamp-2 sm:line-clamp-none'), file + ' must use line-clamp-2 on mobile for subtitle');

      // Check visual stage column has flex-1 min-h-0 to take remaining viewport space
      assert.ok(content.includes('flex-1 min-h-0'), file + ' must give visual stage flex-1 min-h-0');

      // Check image source and dynamic viewport dvh max-height
      assert.ok(content.includes(image), file + ' must render ' + image);
      assert.ok(content.includes('max-h-[22dvh] xs:max-h-[25dvh] sm:max-h-[35dvh] lg:max-h-[440px]'), file + ' must scale image height dynamically with dvh units');
      assert.ok(content.includes('object-contain'), file + ' must use object-contain for 3D building visual');
    });
  });
});
