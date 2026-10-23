import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getPropertyCoverOrFirstImage,
  getFirstUploadedImage,
  getPropertyPhotosList,
  getPropertyMediaList,
  getCategoryFallbackImage,
  isDefaultStockImageUrl,
  isItemCoverPhoto,
  NO_PHOTO_PLACEHOLDER
} from './categoryUtils.js';

describe('EaseLand Property Cover & Uploaded Image Resolution Suite', () => {
  it('1. Returns designated cover photo when isPrimary is true on a media object', () => {
    const property = {
      id: 'prop_test_1',
      title: 'Venture Villa',
      media: [
        { mediaId: 'm1', type: 'PHOTO', publicUrl: 'https://storage.googleapis.com/test/photo1.jpg', isPrimary: false },
        { mediaId: 'm2', type: 'PHOTO', publicUrl: 'https://storage.googleapis.com/test/cover_photo.jpg', isPrimary: true },
        { mediaId: 'm3', type: 'PHOTO', publicUrl: 'https://storage.googleapis.com/test/photo3.jpg', isPrimary: false }
      ]
    };

    const resolved = getPropertyCoverOrFirstImage(property);
    assert.strictEqual(resolved, 'https://storage.googleapis.com/test/cover_photo.jpg');

    const firstUploaded = getFirstUploadedImage(property);
    assert.strictEqual(firstUploaded, 'https://storage.googleapis.com/test/cover_photo.jpg');
  });

  it('2. Returns first uploaded photo when no cover photo is explicitly marked', () => {
    const property = {
      id: 'prop_test_2',
      title: 'Farmland Acreage',
      media: [
        { mediaId: 'm1', type: 'PHOTO', publicUrl: 'https://storage.googleapis.com/test/first_upload.jpg', isPrimary: false },
        { mediaId: 'm2', type: 'PHOTO', publicUrl: 'https://storage.googleapis.com/test/second_upload.jpg', isPrimary: false }
      ]
    };

    const resolved = getPropertyCoverOrFirstImage(property);
    assert.strictEqual(resolved, 'https://storage.googleapis.com/test/first_upload.jpg');
  });

  it('3. Successfully extracts publicUrl from Firebase storage media format', () => {
    // Simulates property "aaa" (ID prop_1792671238027) with user-uploaded image
    const property = {
      id: 'prop_1792671238027',
      title: 'aaa',
      propertyType: 'OPEN_PLOT',
      media: [
        {
          mediaId: 'media_logo_1',
          type: 'PHOTO',
          publicUrl: 'https://firebasestorage.googleapis.com/v0/b/easeland.appspot.com/o/properties%2Fmd_logo.png?alt=media',
          isPrimary: true
        }
      ]
    };

    const resolved = getFirstUploadedImage(property);
    assert.strictEqual(resolved, 'https://firebasestorage.googleapis.com/v0/b/easeland.appspot.com/o/properties%2Fmd_logo.png?alt=media');
    assert.notStrictEqual(resolved, NO_PHOTO_PLACEHOLDER);
    assert.strictEqual(isDefaultStockImageUrl(resolved), false);
  });

  it('4. Returns NO_PHOTO_PLACEHOLDER and NEVER default stock images when property has zero photos', () => {
    const propertyWithoutPhotos = {
      id: 'prop_empty_1',
      title: 'Plot without photos',
      media: [],
      photos: []
    };

    const resolved = getFirstUploadedImage(propertyWithoutPhotos);
    assert.strictEqual(resolved, NO_PHOTO_PLACEHOLDER);
    assert.strictEqual(resolved.startsWith('data:image/svg+xml;base64,'), true);
    assert.strictEqual(isDefaultStockImageUrl(resolved), false);

    // Fallback image helper must also return NO_PHOTO_PLACEHOLDER
    const catFallback = getCategoryFallbackImage(propertyWithoutPhotos);
    assert.strictEqual(catFallback, NO_PHOTO_PLACEHOLDER);
  });

  it('5. Prioritizes cover photo at index 0 in getPropertyPhotosList', () => {
    const property = {
      id: 'prop_test_5',
      title: 'Gated Community Plot',
      media: [
        { mediaId: 'm1', type: 'PHOTO', publicUrl: 'https://storage.googleapis.com/test/img_1.jpg', isPrimary: false },
        { mediaId: 'm2', type: 'PHOTO', publicUrl: 'https://storage.googleapis.com/test/img_cover.jpg', isPrimary: true },
        { mediaId: 'm3', type: 'PHOTO', publicUrl: 'https://storage.googleapis.com/test/img_3.jpg', isPrimary: false }
      ]
    };

    const photos = getPropertyPhotosList(property);
    assert.strictEqual(photos.length, 3);
    assert.strictEqual(photos[0].url, 'https://storage.googleapis.com/test/img_cover.jpg');
    assert.strictEqual(photos[0].isPrimary, true);
    assert.strictEqual(photos[1].url, 'https://storage.googleapis.com/test/img_1.jpg');
    assert.strictEqual(photos[2].url, 'https://storage.googleapis.com/test/img_3.jpg');
  });

  it('6. Filters out video URLs so a video is never used as property image thumbnail', () => {
    const propertyWithVideoFirst = {
      id: 'prop_test_6',
      title: 'Commercial Complex',
      media: [
        { mediaId: 'm_vid', type: 'WALKTHROUGH_VIDEO', publicUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { mediaId: 'm_photo', type: 'PHOTO', publicUrl: 'https://storage.googleapis.com/test/actual_photo.jpg' }
      ]
    };

    const resolved = getFirstUploadedImage(propertyWithVideoFirst);
    assert.strictEqual(resolved, 'https://storage.googleapis.com/test/actual_photo.jpg');
  });

  it('7. Rejects Unsplash default stock photos and treats them as unphotographed', () => {
    const stockUrl = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80';
    assert.strictEqual(isDefaultStockImageUrl(stockUrl), true);

    const propertyWithOnlyStockPhoto = {
      id: 'prop_stock_1',
      title: 'Legacy Property with Stock Fallback',
      media: [
        { mediaId: 'm_stock', type: 'PHOTO', publicUrl: stockUrl }
      ]
    };

    const resolved = getFirstUploadedImage(propertyWithOnlyStockPhoto);
    assert.strictEqual(resolved, NO_PHOTO_PLACEHOLDER);
  });
});
