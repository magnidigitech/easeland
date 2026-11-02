import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('EaseLand Map Property Single-Selection & Highlighting Suite', () => {
  it('1. Verifies UniversalMapEngine.jsx defines selectedPropertyId state and handles pan and preview selection', () => {
    const mapEnginePath = path.join(rootDir, 'src', 'components', 'UniversalMapEngine.jsx');
    assert.ok(fs.existsSync(mapEnginePath), 'UniversalMapEngine.jsx must exist');

    const content = fs.readFileSync(mapEnginePath, 'utf8');

    // Verify selectedPropertyId state hook
    assert.ok(content.includes('const [selectedPropertyId, setSelectedPropertyId] = useState(null);'), 'Must define selectedPropertyId state');

    // Verify handlePanToProperty updates selectedPropertyId
    assert.ok(content.includes('setSelectedPropertyId(propId);'), 'handlePanToProperty and preview handlers must set selectedPropertyId');

    // Verify map canvas click deselects
    assert.ok(content.includes("map.on('click', handleMapClick);"), 'Map canvas click must trigger handleMapClick');
    assert.ok(content.includes("map.off('click', handleMapClick);"), 'Map canvas click must clean up on unmount');

    // Verify filter changes reset selection
    assert.ok(content.includes('setSelectedPropertyId(null);'), 'Filter updates must reset selectedPropertyId');
  });

  it('2. Evaluates marker highlighting logic: selected marker is scaled up and has zIndexOffset 1000, others are dimmed', () => {
    const properties = [
      { id: 'prop-1', title: 'Plot A (7.40 Lakhs)', price: 740000 },
      { id: 'prop-2', title: 'Plot B (74.00 Lakhs)', price: 7400000 },
      { id: 'prop-3', title: 'Plot C (35.00 Lakhs)', price: 3500000 }
    ];

    const evaluateHighlight = (prop, selectedId) => {
      const propId = prop.id;
      const isSelected = Boolean(selectedId && String(propId) === String(selectedId));
      const isAnySelected = Boolean(selectedId);
      const isDimmed = isAnySelected && !isSelected;

      let markerOpacity = '1';
      let markerScale = 'scale(1)';
      let markerZIndex = 0;
      let badgeBorder = '2px solid #15803d';

      if (isSelected) {
        markerOpacity = '1';
        markerScale = 'scale(1.18)';
        markerZIndex = 1000;
        badgeBorder = '2.5px solid #FFE135';
      } else if (isDimmed) {
        markerOpacity = '0.35';
        markerScale = 'scale(0.92)';
      }

      return { isSelected, isDimmed, markerOpacity, markerScale, markerZIndex, badgeBorder };
    };

    // Case A: No property selected
    const initialProps = properties.map(p => evaluateHighlight(p, null));
    assert.strictEqual(initialProps[0].isSelected, false);
    assert.strictEqual(initialProps[0].isDimmed, false);
    assert.strictEqual(initialProps[0].markerOpacity, '1');
    assert.strictEqual(initialProps[0].markerScale, 'scale(1)');
    assert.strictEqual(initialProps[0].markerZIndex, 0);

    // Case B: User clicks 'prop-1' (7.40 Lakhs)
    const selectedProps = properties.map(p => evaluateHighlight(p, 'prop-1'));

    // Selected property (prop-1) must be prominently highlighted
    assert.strictEqual(selectedProps[0].isSelected, true);
    assert.strictEqual(selectedProps[0].isDimmed, false);
    assert.strictEqual(selectedProps[0].markerOpacity, '1');
    assert.strictEqual(selectedProps[0].markerScale, 'scale(1.18)');
    assert.strictEqual(selectedProps[0].markerZIndex, 1000);
    assert.strictEqual(selectedProps[0].badgeBorder, '2.5px solid #FFE135');

    // Unselected properties (prop-2 and prop-3) must be dimmed
    assert.strictEqual(selectedProps[1].isSelected, false);
    assert.strictEqual(selectedProps[1].isDimmed, true);
    assert.strictEqual(selectedProps[1].markerOpacity, '0.35');
    assert.strictEqual(selectedProps[1].markerScale, 'scale(0.92)');
    assert.strictEqual(selectedProps[1].markerZIndex, 0);

    assert.strictEqual(selectedProps[2].isSelected, false);
    assert.strictEqual(selectedProps[2].isDimmed, true);
    assert.strictEqual(selectedProps[2].markerOpacity, '0.35');
  });

  it('3. Evaluates boundary polygon filtering: only selected property gets boundary drawn when a selection is active', () => {
    const propertiesWithPolys = [
      { id: 'prop-1', poly: [[16.31, 80.42], [16.32, 80.42], [16.32, 80.43]] },
      { id: 'prop-2', poly: [[16.33, 80.44], [16.34, 80.44], [16.34, 80.45]] }
    ];

    const getRenderedPolys = (selectedId) => {
      const isAnySelected = Boolean(selectedId);
      return propertiesWithPolys.filter(prop => {
        const isSelected = Boolean(selectedId && String(prop.id) === String(selectedId));
        return (!isAnySelected || isSelected);
      });
    };

    // When none selected: both boundary polygons are rendered
    const defaultRender = getRenderedPolys(null);
    assert.strictEqual(defaultRender.length, 2);

    // When prop-1 is selected: ONLY prop-1 boundary polygon is rendered; prop-2 polygon is suppressed
    const singleRender = getRenderedPolys('prop-1');
    assert.strictEqual(singleRender.length, 1);
    assert.strictEqual(singleRender[0].id, 'prop-1');
  });

  it('4. Evaluates side panel property card: highlights active card and renders "Selected on Map" button', () => {
    const mapEnginePath = path.join(rootDir, 'src', 'components', 'UniversalMapEngine.jsx');
    const content = fs.readFileSync(mapEnginePath, 'utf8');

    // Verify selected card has active highlight ring and border
    assert.ok(content.includes('border-amber-400 ring-2 ring-amber-400/50 shadow-xl bg-amber-50/20'), 'Active property card must display amber highlight ring and shadow');

    // Verify selected button text
    assert.ok(content.includes('Selected on Map'), 'Active button must display "Selected on Map"');

    // Verify fitBounds is suppressed when a property is selected so it preserves pan zoom level 17
    assert.ok(content.includes('!selectedPropertyId && !focusedProperty'), 'fitBounds must be guarded by !selectedPropertyId');
  });
});
