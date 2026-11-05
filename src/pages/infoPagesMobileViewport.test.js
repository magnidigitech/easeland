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
    assert.ok(cssContent.includes('min-height: calc(100dvh - 8rem)'), 'info-hero-dynamic must calculate min-height minus 8rem (top 4rem + bottom 4rem)');
    assert.ok(cssContent.includes('env(safe-area-inset-bottom'), 'info-hero-dynamic must support safe-area-inset-bottom');
    assert.ok(cssContent.includes('min-height: calc(100dvh - 9rem)'), 'info-hero-dynamic must support sm tablet at 9rem offset');
    assert.ok(cssContent.includes('min-height: calc(100dvh - 5rem)'), 'info-hero-dynamic must support md tablet where bottom nav is hidden');
    assert.ok(cssContent.includes('justify-content: center'), 'info-hero-dynamic must center content to prevent excessive padding');
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
    it('3. Verifies ' + name + ' uses dynamic viewport hero container and balanced image sizing', () => {
      const filePath = path.join(rootDir, 'src', 'pages', file);
      assert.ok(fs.existsSync(filePath), file + ' must exist');
      const content = fs.readFileSync(filePath, 'utf8');

      // Check dynamic viewport hero container class
      assert.ok(content.includes('info-hero-dynamic'), file + ' must use info-hero-dynamic class');

      // Check balanced flex layout
      assert.ok(content.includes('w-full flex flex-col items-center justify-center lg:grid lg:grid-cols-12'), file + ' must distribute space with balanced flex layout');

      // Check clean, uncrushed headline size
      assert.ok(content.includes('text-2xl sm:text-3xl lg:text-5xl font-extrabold'), file + ' must use clean uncrushed headline on mobile');

      // Check subtitle is readable and not truncated
      assert.ok(content.includes('leading-relaxed'), file + ' must have relaxed leading for subtitle');

      // Check visual stage column uses clean w-fit centering without excess padding
      assert.ok(content.includes('w-fit mx-auto flex items-center justify-center'), file + ' must wrap image with w-fit mx-auto');

      // Check image source and responsive max-height
      assert.ok(content.includes(image), file + ' must render ' + image);
      assert.ok(content.includes('max-h-[220px] xs:max-h-[250px] sm:max-h-[350px] lg:max-h-[440px]'), file + ' must scale image height gracefully');
      assert.ok(content.includes('object-contain'), file + ' must use object-contain for 3D building visual');

      // Check floating badges are hidden on mobile to avoid clutter and clipping
      assert.ok(content.includes('hidden sm:flex absolute'), file + ' must hide floating micro-badges on mobile');
    });
  });

  it('4. Verifies desktop dynamic viewport height (dvh) fitting across all hero banners without affecting PWA mobile versions', () => {
    const cssPath = path.join(rootDir, 'src', 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Desktop rule for info-hero-dynamic must dynamically calculate dvh minus desktop navbar
    assert.ok(cssContent.includes('.info-hero-dynamic'), 'index.css must define .info-hero-dynamic');
    assert.ok(
      cssContent.includes('min-height: calc(100dvh - var(--desktop-nav-height, 5rem))') ||
      cssContent.includes('min-height: calc(100dvh - 5rem)'),
      'info-hero-dynamic must dynamically fit desktop dvh minus desktop navbar'
    );
    assert.ok(cssContent.includes('--desktop-nav-height: 5rem'), ':root must define --desktop-nav-height dynamically');

    // Desktop rule for home-hero-dynamic must dynamically calculate dvh minus desktop navbar
    assert.ok(cssContent.includes('.home-hero-dynamic'), 'index.css must define .home-hero-dynamic');
    assert.ok(
      cssContent.includes('min-height: calc(100dvh - var(--desktop-nav-height, 5rem))') ||
      cssContent.includes('min-height: calc(100dvh - 5rem)'),
      'home-hero-dynamic must dynamically fit desktop dvh minus desktop navbar'
    );

    // HeroSearch must use home-hero-dynamic and dynamic desktop dvh utility
    const heroSearchPath = path.join(rootDir, 'src', 'components', 'HeroSearch.jsx');
    const heroSearchContent = fs.readFileSync(heroSearchPath, 'utf8');
    assert.ok(heroSearchContent.includes('home-hero-dynamic'), 'HeroSearch must include home-hero-dynamic class');
    assert.ok(heroSearchContent.includes('lg:min-h-[calc(100dvh-5rem)]'), 'HeroSearch must include lg:min-h dynamic dvh utility');
    assert.ok(heroSearchContent.includes('lg:flex lg:flex-col lg:justify-center'), 'HeroSearch must vertically center content on desktop');

    // Mobile PWA preservation checks: mobile offsets and safe-area rules must be 100% intact
    assert.ok(cssContent.includes('min-height: calc(100dvh - 8rem)'), 'Mobile PWA offset (8rem) must remain intact');
    assert.ok(cssContent.includes('min-height: calc(100dvh - 9rem)'), 'Tablet PWA offset (9rem) must remain intact');
    assert.ok(cssContent.includes('env(safe-area-inset-bottom'), 'Safe area inset bottom must remain intact');
  });

  it('5. Verifies ECC fluid typography and stage scaling for desktop and large displays without affecting PWA mobile versions', () => {
    const cssPath = path.join(rootDir, 'src', 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Fluid typography rules in index.css
    assert.ok(cssContent.includes('.hero-title-fluid'), 'index.css must define .hero-title-fluid');
    assert.ok(cssContent.includes('.hero-subtitle-fluid'), 'index.css must define .hero-subtitle-fluid');
    assert.ok(cssContent.includes('.hero-figure-fluid'), 'index.css must define .hero-figure-fluid');
    assert.ok(cssContent.includes('.home-title-fluid'), 'index.css must define .home-title-fluid');
    assert.ok(cssContent.includes('.home-subtitle-fluid'), 'index.css must define .home-subtitle-fluid');
    assert.ok(cssContent.includes('.home-card-fluid'), 'index.css must define .home-card-fluid');

    // Clamp assertions ensuring fluid scaling
    assert.ok(cssContent.includes('clamp(2.25rem, 1.5rem + 1.4vw, 3.75rem)'), 'hero-title-fluid must scale dynamically between 2.25rem and 3.75rem');
    assert.ok(cssContent.includes('clamp(380px, 200px + 18vh, 520px)'), 'hero-figure-fluid must scale 3D building visual height dynamically');
    assert.ok(cssContent.includes('max-height: 820px'), 'index.css must provide safeguard for compact laptop viewports');

    // Check all 3 info pages use fluid classes
    pages.forEach(({ name, file }) => {
      const filePath = path.join(rootDir, 'src', 'pages', file);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.ok(content.includes('hero-title-fluid'), file + ' must use hero-title-fluid class');
      assert.ok(content.includes('hero-subtitle-fluid'), file + ' must use hero-subtitle-fluid class');
      assert.ok(content.includes('hero-figure-fluid'), file + ' must use hero-figure-fluid class');
      // Verify mobile headline classes remain completely intact
      assert.ok(content.includes('text-2xl sm:text-3xl lg:text-5xl font-extrabold'), file + ' must keep mobile headline scale');
    });

    // Check HeroSearch uses fluid classes
    const heroSearchPath = path.join(rootDir, 'src', 'components', 'HeroSearch.jsx');
    const heroSearchContent = fs.readFileSync(heroSearchPath, 'utf8');
    assert.ok(heroSearchContent.includes('home-title-fluid'), 'HeroSearch must use home-title-fluid');
    assert.ok(heroSearchContent.includes('home-subtitle-fluid'), 'HeroSearch must use home-subtitle-fluid');
    assert.ok(heroSearchContent.includes('home-card-fluid'), 'HeroSearch must use home-card-fluid');
  });
});
