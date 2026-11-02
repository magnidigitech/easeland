import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('EaseLand Navbar Hamburger Menu Auto-Close on Scroll Suite', () => {
  it('1. Verifies Navbar.jsx has scroll event listener, drawer ref, and jitter-protected downward auto-close logic', () => {
    const navbarPath = path.join(rootDir, 'src', 'components', 'Navbar.jsx');
    assert.ok(fs.existsSync(navbarPath), 'Navbar.jsx must exist');

    const content = fs.readFileSync(navbarPath, 'utf8');

    // Verify useRef is imported
    assert.ok(content.includes('useRef'), 'Navbar.jsx must import and use useRef');

    // Verify drawerRef is declared
    assert.ok(content.includes('const drawerRef = useRef(null);'), 'Navbar.jsx must declare drawerRef');

    // Verify scroll event listener is attached with passive: true
    assert.ok(content.includes("window.addEventListener('scroll', handleScroll, { passive: true, capture: true });"), 'Navbar.jsx must attach passive capture scroll listener');

    // Verify scroll listener cleans up on unmount or close
    assert.ok(content.includes("window.removeEventListener('scroll', handleScroll, { capture: true });"), 'Navbar.jsx must remove scroll listener cleanly');

    // Verify drawerRef is attached to the mobile drawer element
    assert.ok(content.includes('ref={drawerRef}'), 'Navbar.jsx must attach drawerRef to the mobile drawer element');

    // Verify inside-drawer scroll ignore logic
    assert.ok(content.includes('drawerRef.current.contains(e.target)'), 'Navbar.jsx must not close when scrolling inside the drawer itself');

    // Verify downward scroll threshold comparison
    assert.ok(content.includes('currentScrollY > lowestScrollY + 25'), 'Navbar.jsx must close when scrolled down past lowestScrollY + 25');

    // Verify auto-close on activePage change
    assert.ok(content.includes('[activePage]'), 'Navbar.jsx must close menu when activePage changes');
  });

  it('2. Evaluates scroll algorithm: ignores finger wobble (under 25px) and stays open', () => {
    let mobileMenuOpen = true;
    const setMobileMenuOpen = (val) => { mobileMenuOpen = val; };

    const openScrollY = 100;
    let lowestScrollY = openScrollY;

    const handleScroll = (currentScrollY) => {
      if (currentScrollY < lowestScrollY) {
        lowestScrollY = currentScrollY;
      }
      if (currentScrollY > lowestScrollY + 25) {
        setMobileMenuOpen(false);
      }
    };

    // Minor finger tap jitter (e.g. 5px scroll)
    handleScroll(105);
    assert.strictEqual(mobileMenuOpen, true, 'Menu must remain open during minor finger wobble');

    handleScroll(115);
    assert.strictEqual(mobileMenuOpen, true, 'Menu must remain open within 25px threshold');
  });

  it('3. Evaluates scroll algorithm: closes when scrolling down past 25px from open position', () => {
    let mobileMenuOpen = true;
    const setMobileMenuOpen = (val) => { mobileMenuOpen = val; };

    const openScrollY = 0;
    let lowestScrollY = openScrollY;

    const handleScroll = (currentScrollY) => {
      if (currentScrollY < lowestScrollY) {
        lowestScrollY = currentScrollY;
      }
      if (currentScrollY > lowestScrollY + 25) {
        setMobileMenuOpen(false);
      }
    };

    // User scrolls down past menu
    handleScroll(26);
    assert.strictEqual(mobileMenuOpen, false, 'Menu must close when scrolled down past 25px');
  });

  it('4. Evaluates scroll algorithm: upward scroll does not close menu, but scrolling back down closes it', () => {
    let mobileMenuOpen = true;
    const setMobileMenuOpen = (val) => { mobileMenuOpen = val; };

    const openScrollY = 400;
    let lowestScrollY = openScrollY;

    const handleScroll = (currentScrollY) => {
      if (currentScrollY < lowestScrollY) {
        lowestScrollY = currentScrollY;
      }
      if (currentScrollY > lowestScrollY + 25) {
        setMobileMenuOpen(false);
      }
    };

    // User scrolls UP from 400 to 300
    handleScroll(300);
    assert.strictEqual(mobileMenuOpen, true, 'Upward scroll must NOT close the menu');
    assert.strictEqual(lowestScrollY, 300, 'lowestScrollY must update to 300');

    // User now scrolls down past lowestScrollY + 25 (326)
    handleScroll(326);
    assert.strictEqual(mobileMenuOpen, false, 'Scrolling down past lowestScrollY + 25 must close the menu');
  });
});
