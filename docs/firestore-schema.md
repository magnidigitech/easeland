# EaseLand — Firestore Schema & Data Layer Specification (Block 5)

## Executive Summary
This specification documents the complete, canonical Cloud Firestore schema and data access foundation for EaseLand (`asia-south1` Mumbai region). It establishes a three-tier property data security boundary, a pan-India location hierarchy, user capability models, CRM lifecycle collections, site management structures, and a comprehensive indexing plan compatible with Block 4A Security Rules.

---

## 1. Canonical Enums & Status Value Registry

All status strings across EaseLand are strictly standardized to prevent string mismatches.

```javascript
// Listing Statuses
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

// Verification Statuses
export const VerificationStatus = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  CHANGES_REQUIRED: 'CHANGES_REQUIRED',
  REJECTED: 'REJECTED'
};

// Boundary Statuses
export const BoundaryStatus = {
  NOT_PROVIDED: 'NOT_PROVIDED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  CHANGES_REQUIRED: 'CHANGES_REQUIRED',
  REJECTED: 'REJECTED'
};

// Property Types
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

// Purposes
export const Purpose = {
  SALE: 'SALE',
  RENT: 'RENT',
  LEASE: 'LEASE'
};

// Media Verification Statuses
export const MediaStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

// Document Types
export const DocumentType = {
  SALE_DEED: 'SALE_DEED',
  TITLE_DEED: 'TITLE_DEED',
  ENCUMBRANCE_CERTIFICATE: 'ENCUMBRANCE_CERTIFICATE',
  TAX_RECEIPT: 'TAX_RECEIPT',
  LAYOUT_APPROVAL: 'LAYOUT_APPROVAL',
  OTHER: 'OTHER'
};

// User Account Statuses
export const AccountStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED'
};

// Owner Verification States
export const OwnerVerificationState = {
  NOT_VERIFIED: 'NOT_VERIFIED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED'
};

// Enquiry Statuses
export const EnquiryStatus = {
  SUBMITTED: 'SUBMITTED',
  CONTACTED: 'CONTACTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED'
};

// Deal Stages
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

// Follow-Up Statuses
export const FollowUpStatus = {
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
  NO_SHOW: 'NO_SHOW'
};

// Report Categories
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

// Report Statuses
export const ReportStatus = {
  SUBMITTED: 'SUBMITTED',
  UNDER_INVESTIGATION: 'UNDER_INVESTIGATION',
  RESOLVED_ACTION_TAKEN: 'RESOLVED_ACTION_TAKEN',
  DISMISSED: 'DISMISSED'
};

// CMS Publishing States
export const CMSState = {
  DRAFT: 'DRAFT',
  PREVIEW: 'PREVIEW',
  PUBLISHED: 'PUBLISHED'
};
```

---

## 2. Collection Schemas & Data Models

### 2.1 `users/{uid}`
- **Purpose**: Central user profile and capabilities.
- **Document ID**: Firebase Auth `uid`.
- **Fields**:
  - `uid` (string, required): Firebase Auth UID.
  - `email` (string, required): Lowercase primary email.
  - `displayName` (string, required): Full display name.
  - `phone` (string, required): 10-digit primary mobile number.
  - `photoURL` (string, optional): Storage profile photo reference.
  - `capabilities` (array of strings, required): `["CUSTOMER"]` or `["CUSTOMER", "OWNER"]`. Allows dual customer and owner actions simultaneously.
  - `ownerVerificationState` (string, required): Enum `OwnerVerificationState`.
  - `adminRole` (string, optional): Descriptive field (`"SUPER_ADMIN"`, `"VERIFICATION_ADMIN"`). *Authorization is strictly enforced by Firebase Auth Custom Claim `request.auth.token.adminRole`.*
  - `accountStatus` (string, required): Enum `AccountStatus`.
  - `emailVerified` (boolean, required): Synced from Auth.
  - `phoneVerified` (boolean, required): Reserved for future phone OTP validation (Phone Auth currently disabled).
  - `preferences` (map, optional): `{ emailAlerts: boolean, smsAlerts: boolean }`.
  - `createdAt` (timestamp, required): `FieldValue.serverTimestamp()`.
  - `updatedAt` (timestamp, required): `FieldValue.serverTimestamp()`.

---

### 2.2 `users/{uid}/wishlist/{propertyId}` (**Subcollection**)
- **Purpose**: Fast, user-scoped saved properties.
- **Document ID**: `propertyId`.
- **Fields**:
  - `propertyId` (string, required): Reference to public property ID.
  - `savedAt` (timestamp, required): `FieldValue.serverTimestamp()`.

---

### 2.3 `properties/{propertyId}` (**Tier 1: Public Marketplace Listing**)
- **Purpose**: Public marketplace data accessible by buyers and customers.
- **Document ID**: Firestore Auto-ID (`propertyId`).
- **Fields**:
  - `propertyId` (string, required): Firestore document ID.
  - `referenceId` (string, required): Human-readable code e.g. `EL-PROP-10042`.
  - `ownerId` (string, required): Listing owner Auth UID.
  - `ownerPublicName` (string, required): Display name of owner.
  - `ownerPublicPhone` (string, optional): Contact number if owner opts in for direct buyer calls.
  - `title` (string, required).
  - `propertyType` (string, required): Enum `PropertyType`.
  - `purpose` (string, required): Enum `Purpose`.
  - `description` (string, required).
  - `price` (number, required): Price in Indian Rupees.
  - `priceDisplay` (string, required): E.g. "Rs. 75 Lakhs", "Rs. 5.00 Crores", "Rs. 38,000 / month".
  - `area` (number, required): Numeric area in sq ft.
  - `areaDisplay` (string, required): E.g. "1,800 sq ft (40 x 45 ft)".
  - `facing` (string, optional): `"East"`, `"North-East"`, `"North"`, etc.
  - `bedrooms` (number, optional).
  - `bathrooms` (number, optional).
  - `floors` (number, optional).
  - `propertyAge` (string, optional).
  - `furnishing` (string, optional).
  - `amenities` (array of strings, optional).
  
  - **Public Approved Media Array** (Max 20 items):
    - `media` (array of maps): Only items with `verificationStatus == "APPROVED"` are exposed to customers.
      - `mediaId` (string)
      - `type` (string: `"PHOTO"`, `"WALKTHROUGH_VIDEO"`, `"DRONE_VIDEO"`)
      - `publicUrl` (string: Public Cloud Storage CDN URL)
      - `thumbnailUrl` (string, optional)
      - `displayOrder` (number)
      - `verificationStatus` (string: Enum `MediaStatus`)

  - **Pan-India Geographic Location Hierarchy**:
    - `location` (map, required):
      - `country` (string): `"India"`.
      - `state` (string): State or Union Territory e.g. `"Andhra Pradesh"`, `"Telangana"`, `"Karnataka"`.
      - `district` (string): District e.g. `"Guntur"`, `"Ranga Reddy"`, `"Bengaluru Urban"`.
      - `city` (string): City or Town e.g. `"Guntur"`, `"Hyderabad"`, `"Bengaluru"`.
      - `mandal` (string): Mandal, Taluk, or Tehsil e.g. `"Guntur East Mandal"`.
      - `locality` (string): Locality or Neighborhood e.g. `"Vidyanagar"`.
      - `subLocality` (string, optional).
      - `village` (string, optional): Revenue village name.
      - `road` (string, optional): Street name.
      - `colony` (string, optional): Layout name.
      - `landmark` (string, optional).
      - `postalCode` (string, required): 6-digit PIN code.
      - `address` (string, required): Full street address.
      - `geoPoint` (GeoPoint, required): Native Firestore `GeoPoint(lat, lng)`.
      - `geohash` (string, required): 9-character Geohash string for 2D spatial queries.

  - **Approved Public Boundary**:
    - `boundary` (map, optional):
      - `approvedPolygon` (array of maps): System-approved vertices `[{ lat: number, lng: number }]`.
      - `source` (string): `"OWNER_DRAWN"`, `"GPS_FIELD_SURVEY"`, `"ADMIN_SURVEY"`.

  - **Protected System-Controlled Status Fields**:
    - `listingStatus` (string, required): Enum `ListingStatus`.
    - `isPlatformVerified` (boolean, required): Verified badge state.
    - `views` (number, default 0).
    - `enquiriesCount` (number, default 0).
  - `createdAt` (timestamp, required): `FieldValue.serverTimestamp()`.
  - `updatedAt` (timestamp, required): `FieldValue.serverTimestamp()`.

---

### 2.4 `propertyPrivate/{propertyId}` (**Tier 2: Owner-Visible Private Data**)
- **Purpose**: Owner-visible confidential details and feedback.
- **Document ID**: Same `propertyId` as public property document.
- **Access**: Owner & Authorized Admin ONLY. Public/Customers BLOCKED.
- **Fields**:
  - `propertyId` (string, required).
  - `ownerId` (string, required).
  - `ownerPrivateEmail` (string, required): Confidential owner email.
  - `ownerPrivatePhone` (string, required): Confidential owner phone.
  - `ownerFacingNotes` (string, optional): Auditor feedback e.g. "Upload clearer deed scan".
  - `changesRequestedChecklist` (array of strings, optional): Action items for approval.
  - `createdAt` (timestamp, required): `FieldValue.serverTimestamp()`.
  - `updatedAt` (timestamp, required): `FieldValue.serverTimestamp()`.

---

### 2.5 `propertyAdminInternal/{propertyId}` (**Tier 3: Admin-Only Internal Audit Data**)
- **Purpose**: Internal admin review notes and risk scores.
- **Document ID**: Same `propertyId` as public property document.
- **Access**: Authorized Admin ONLY. Owner & Customers BLOCKED.
- **Fields**:
  - `propertyId` (string, required).
  - `assignedAuditorId` (string, optional): Admin UID auditing listing.
  - `auditorPrivateNotes` (string, optional): Internal assessment.
  - `internalFlagCount` (number, default 0).
  - `riskScore` (string, optional): `"LOW"`, `"MEDIUM"`, `"HIGH"`.
  - `moderationHistory` (array of maps, optional).
  - `createdAt` (timestamp, required).
  - `updatedAt` (timestamp, required).

---

### 2.6 `propertyDocuments/{docId}` (**Confidential Legal Documents**)
- **Purpose**: Metadata for private title deeds, ECs, and tax receipts.
- **Document ID**: Firestore Auto-ID.
- **Access**: Document Owner & Admin ONLY. Public/Customers BLOCKED.
- **Fields**:
  - `docId` (string, required).
  - `propertyId` (string, required).
  - `ownerId` (string, required).
  - `documentName` (string, required): E.g. `"Registered Sale Deed"`.
  - `documentType` (string, required): Enum `DocumentType`.
  - `storagePath` (string, required): Private Storage path (`private_docs/properties/{propertyId}/{docId}.pdf`).
  - `verificationStatus` (string, required): Enum `VerificationStatus`.
  - `adminFeedback` (string, optional).
  - `createdAt` (timestamp, required).

---

### 2.7 `verificationRecords/{verificationId}`
- **Purpose**: Immutable history of property verification audits.
- **Document ID**: Firestore Auto-ID.
- **Fields**:
  - `verificationId` (string, required).
  - `propertyId` (string, required).
  - `ownerId` (string, required).
  - `adminId` (string, required).
  - `action` (string, required): `"SUBMITTED"`, `"STARTED_REVIEW"`, `"APPROVED"`, `"CHANGES_REQUESTED"`, `"REJECTED"`, `"RESUBMITTED"`.
  - `previousStatus` (string, required).
  - `newStatus` (string, required).
  - `auditorNotes` (string, required).
  - `timestamp` (timestamp, required): `FieldValue.serverTimestamp()`.

---

### 2.8 `enquiries/{enquiryId}`
- **Purpose**: Direct buyer enquiries to property owners.
- **Document ID**: Firestore Auto-ID.
- **Fields**:
  - `enquiryId` (string, required).
  - `propertyId` (string, required).
  - `propertyTitle` (string, denormalized snapshot).
  - `ownerId` (string, required).
  - `ownerName` (string, denormalized snapshot).
  - `buyerId` (string, required).
  - `buyerName` (string, denormalized snapshot).
  - `buyerEmail` (string, denormalized snapshot).
  - `buyerPhone` (string, denormalized snapshot).
  - `message` (string, required).
  - `preferredVisitDate` (string, optional).
  - `status` (string, required): Enum `EnquiryStatus`.
  - `createdAt` (timestamp, required).
  - `updatedAt` (timestamp, required).

---

### 2.9 `deals/{dealId}`
- **Purpose**: Internal Deal CRM pipeline.
- **Document ID**: Firestore Auto-ID.
- **Fields**:
  - `dealId` (string, required).
  - `propertyId` (string, required).
  - `propertyTitle` (string, denormalized snapshot).
  - `ownerId` (string, required).
  - `buyerId` (string, required).
  - `enquiryId` (string, optional).
  - `assignedAdminId` (string, optional).
  - `stage` (string, required): Enum `DealStage`.
  - `dealAmount` (number, optional).
  - `notes` (string, optional).
  - `lastUpdate` (string, required).
  - `createdAt` (timestamp, required).
  - `updatedAt` (timestamp, required).

---

### 2.10 `followUps/{followUpId}`
- **Purpose**: Site visit schedules and follow-up tasks.
- **Document ID**: Firestore Auto-ID.
- **Fields**:
  - `followUpId` (string, required).
  - `dealId` (string, optional).
  - `propertyId` (string, required).
  - `customerId` (string, required).
  - `ownerId` (string, required).
  - `assignedAdminId` (string, optional).
  - `scheduledDateTime` (timestamp, required).
  - `type` (string, required): `"SITE_VISIT"`, `"CALL_BACK"`, `"DOCUMENT_VERIFICATION"`, `"FINAL_CLOSING"`.
  - `status` (string, required): Enum `FollowUpStatus`.
  - `outcomeNotes` (string, optional).
  - `createdAt` (timestamp, required).
  - `updatedAt` (timestamp, required).

---

### 2.11 `reports/{reportId}`
- **Purpose**: User dispute and flag tickets.
- **Document ID**: Firestore Auto-ID.
- **Fields**:
  - `reportId` (string, required).
  - `reporterId` (string, required).
  - `propertyId` (string, required).
  - `category` (string, required): Enum `ReportCategory`.
  - `description` (string, required).
  - `status` (string, required): Enum `ReportStatus`.
  - `assignedAdminId` (string, optional).
  - `resolutionNotes` (string, optional).
  - `createdAt` (timestamp, required).
  - `updatedAt` (timestamp, required).

---

### 2.12 `notifications/{notificationId}`
- **Purpose**: User target notifications.
- **Document ID**: Firestore Auto-ID.
- **Fields**:
  - `notificationId` (string, required).
  - `recipientId` (string, required).
  - `title` (string, required).
  - `message` (string, required).
  - `type` (string, required): `"SUCCESS"`, `"WARNING"`, `"ENQUIRY"`, `"INFO"`.
  - `relatedEntityType` (string, optional): `"PROPERTY"`, `"ENQUIRY"`, `"VERIFICATION"`.
  - `relatedEntityId` (string, optional).
  - `read` (boolean, default false).
  - `createdAt` (timestamp, required).

---

### 2.13 `activityLogs/{logId}` (**System Audit Log**)
- **Purpose**: System-generated immutable audit trail.
- **Access**: Read: Admin ONLY. Client Writes: BLOCKED (Server-generated only).
- **Fields**:
  - `logId` (string, required).
  - `actorId` (string, required).
  - `actorName` (string, required).
  - `actorRole` (string, required): `"USER"`, `"OWNER"`, `"ADMIN"`.
  - `action` (string, required).
  - `entityType` (string, required).
  - `entityId` (string, required).
  - `previousState` (map, optional).
  - `newState` (map, optional).
  - `ipAddress` (string, optional).
  - `timestamp` (timestamp, required).

---

### 2.14 `siteManagement/{moduleId}` (**CMS Modules**)
- **Purpose**: Site Management Panel configuration.
- **Document ID**: `config`, `homepage`, `buypage`, `rentpage`, `sellpage`.
- **Fields**:
  - `moduleId` (string, required).
  - `theme` (map): Colors, fonts, branding tokens.
  - `content` (map): Headlines, banners, cards, FAQs.
  - `state` (string, required): Enum `CMSState`.
  - `lastPublishedBy` (string, optional).
  - `lastPublishedTime` (timestamp, optional).
  - `updatedAt` (timestamp, required).

---

## 3. Required Indexing Plan

1. **Marketplace Filter Index**:
   - `listingStatus` (ASC) + `purpose` (ASC) + `propertyType` (ASC) + `price` (ASC)
2. **City Property Filter Index**:
   - `listingStatus` (ASC) + `location.city` (ASC) + `price` (ASC)
3. **District Category Index**:
   - `listingStatus` (ASC) + `location.district` (ASC) + `propertyType` (ASC) + `createdAt` (DESC)
4. **Geohash Bounding Box Index**:
   - `listingStatus` (ASC) + `geohash` (ASC) + `price` (ASC)
5. **Owner Dashboard Properties Index**:
   - `ownerId` (ASC) + `listingStatus` (ASC) + `createdAt` (DESC)
6. **Enquiries Owner Inbox Index**:
   - `ownerId` (ASC) + `status` (ASC) + `createdAt` (DESC)
7. **User Notifications Index**:
   - `recipientId` (ASC) + `read` (ASC) + `createdAt` (DESC)
