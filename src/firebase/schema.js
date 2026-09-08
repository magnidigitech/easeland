/**
 * EaseLand Centralized Schema Constants, Enums & Data Model Helpers (Block 5)
 */

export const ListingStatus = {
  DRAFT: 'DRAFT',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  UNDER_REVIEW: 'UNDER_REVIEW',
  CHANGES_REQUIRED: 'CHANGES_REQUIRED',
  LIVE: 'LIVE',
  REJECTED: 'REJECTED',
  SOLD: 'SOLD',
  RENTED: 'RENTED',
  UNAVAILABLE: 'UNAVAILABLE',
  ARCHIVED: 'ARCHIVED'
};

export const VerificationStatus = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  CHANGES_REQUIRED: 'CHANGES_REQUIRED',
  REJECTED: 'REJECTED'
};

export const BoundaryStatus = {
  NOT_PROVIDED: 'NOT_PROVIDED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  CHANGES_REQUIRED: 'CHANGES_REQUIRED',
  REJECTED: 'REJECTED'
};

export const BoundarySource = {
  DRAWN_ON_MAP: 'DRAWN_ON_MAP',
  GPS_ASSISTED: 'GPS_ASSISTED',
  UPLOADED_PLOT_MAP: 'UPLOADED_PLOT_MAP'
};

export const PropertyType = {
  OPEN_PLOT: 'OPEN_PLOT',
  HOUSE: 'HOUSE',
  APARTMENT: 'APARTMENT',
  VILLA: 'VILLA',
  COMMERCIAL: 'COMMERCIAL',
  RENTAL: 'RENTAL',
  LAND: 'LAND',
  OTHER: 'OTHER'
};

export const Purpose = {
  SALE: 'SALE',
  RENT: 'RENT',
  LEASE: 'LEASE'
};

export const MediaType = {
  PHOTO: 'PHOTO',
  WALKTHROUGH_VIDEO: 'WALKTHROUGH_VIDEO',
  DRONE_VIDEO: 'DRONE_VIDEO'
};

export const MediaStatus = {
  UPLOADING: 'UPLOADING',
  UPLOADED: 'UPLOADED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REMOVED: 'REMOVED'
};

export const DocumentType = {
  OWNERSHIP_DOCUMENT: 'OWNERSHIP_DOCUMENT',
  TITLE_DEED: 'TITLE_DEED',
  SALE_DEED: 'SALE_DEED',
  ENCUMBRANCE_CERTIFICATE: 'ENCUMBRANCE_CERTIFICATE',
  TAX_RECEIPT: 'TAX_RECEIPT',
  LAYOUT_APPROVAL: 'LAYOUT_APPROVAL',
  IDENTITY_DOCUMENT: 'IDENTITY_DOCUMENT',
  PROPERTY_DOCUMENT: 'PROPERTY_DOCUMENT',
  APPROVAL_DOCUMENT: 'APPROVAL_DOCUMENT',
  OTHER: 'OTHER'
};

export const AccountStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED'
};

export const OwnerVerificationState = {
  NOT_VERIFIED: 'NOT_VERIFIED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED'
};

export const EnquiryStatus = {
  SUBMITTED: 'SUBMITTED',
  CONTACTED: 'CONTACTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED'
};

export const DealStage = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  INTERESTED: 'INTERESTED',
  SITE_VISIT: 'SITE_VISIT',
  NEGOTIATION: 'NEGOTIATION',
  FOLLOW_UP: 'FOLLOW_UP',
  CLOSED: 'CLOSED',
  REJECTED: 'REJECTED'
};

export const FollowUpStatus = {
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
  NO_SHOW: 'NO_SHOW'
};

export const ReportCategory = {
  FAKE_PROPERTY: 'FAKE_PROPERTY',
  WRONG_LOCATION: 'WRONG_LOCATION',
  WRONG_PRICE: 'WRONG_PRICE',
  DUPLICATE: 'DUPLICATE',
  SOLD: 'SOLD',
  RENTED: 'RENTED',
  SUSPICIOUS: 'SUSPICIOUS',
  OTHER: 'OTHER'
};

export const ReportStatus = {
  SUBMITTED: 'SUBMITTED',
  UNDER_INVESTIGATION: 'UNDER_INVESTIGATION',
  RESOLVED_ACTION_TAKEN: 'RESOLVED_ACTION_TAKEN',
  DISMISSED: 'DISMISSED'
};

export const CMSState = {
  DRAFT: 'DRAFT',
  PREVIEW: 'PREVIEW',
  PUBLISHED: 'PUBLISHED'
};

/**
 * Creates standardized pan-India Location object structure
 */
export function createLocationModel({
  country = 'India',
  state = '',
  district = '',
  city = '',
  mandal = '',
  locality = '',
  subLocality = '',
  village = '',
  road = '',
  colony = '',
  landmark = '',
  postalCode = '',
  address = '',
  geoPoint = null,
  geohash = ''
}) {
  return {
    country,
    state,
    district,
    city,
    mandal,
    locality,
    subLocality,
    village,
    road,
    colony,
    landmark,
    postalCode,
    address,
    geoPoint,
    geohash
  };
}
