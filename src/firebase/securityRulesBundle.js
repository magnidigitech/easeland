export const fsRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function isUser(uid) { return isSignedIn() && request.auth.uid == uid; }
    function isAdmin() {
      return isSignedIn() && request.auth.token.keys().hasAll(['adminRole']) && request.auth.token.adminRole != null;
    }
    function isNotSuspended() {
      return !isSignedIn() || !exists(/databases/$(database)/documents/users/$(request.auth.uid)) || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.accountStatus != 'SUSPENDED';
    }
    function isValidOwnerStatusTransition() {
      let oldStatus = resource.data.listingStatus;
      let newStatus = request.resource.data.listingStatus;
      let newPub = request.resource.data.isPublished;
      return (
        (oldStatus in ['DRAFT', 'CHANGES_REQUIRED'] && newStatus == 'PENDING_VERIFICATION' && newPub == false) ||
        (oldStatus == 'LIVE' && newStatus in ['UNAVAILABLE', 'SOLD', 'RENTED', 'ARCHIVED'] && newPub == false) ||
        (oldStatus == 'UNAVAILABLE' && newStatus == 'LIVE' && resource.data.isPlatformVerified == true && newPub == true)
      );
    }
    function isModifyingProtectedPropertyFields() {
      let affected = request.resource.data.diff(resource.data).affectedKeys();
      let statusChanged = affected.hasAny(['listingStatus']);
      let pubChanged = affected.hasAny(['isPublished']);
      let invalidStatusOrPub = (statusChanged || pubChanged) && !isValidOwnerStatusTransition();
      return invalidStatusOrPub || affected.hasAny([
        'isPlatformVerified', 'verificationStatus', 'boundaryStatus',
        'boundary', 'views', 'enquiriesCount', 'ownerId', 'referenceId', 'verifiedDate', 'verificationNotes'
      ]);
    }
    match /properties/{propertyId} {
      allow read: if (resource != null && resource.data.listingStatus == 'LIVE' && resource.data.isPublished == true)
                  || (isSignedIn() && resource != null && resource.data.ownerId == request.auth.uid)
                  || isAdmin();
      allow create: if isSignedIn()
                    && request.resource.data.ownerId == request.auth.uid
                    && request.resource.data.listingStatus in ['DRAFT', 'PENDING_VERIFICATION']
                    && request.resource.data.isPlatformVerified == false
                    && request.resource.data.views == 0
                    && request.resource.data.enquiriesCount == 0;
      allow update: if (
        isSignedIn()
        && resource.data.ownerId == request.auth.uid
        && !isModifyingProtectedPropertyFields()
      ) || isAdmin();
      allow delete: if (isSignedIn() && resource.data.ownerId == request.auth.uid) || isAdmin();
    }
    match /propertyPrivate/{propertyId} {
      allow read: if (isSignedIn() && resource != null && resource.data.ownerId == request.auth.uid) || isAdmin();
      allow create: if (isSignedIn() && request.resource.data.ownerId == request.auth.uid) || isAdmin();
      allow update: if (
        isSignedIn()
        && resource.data.ownerId == request.auth.uid
        && request.resource.data.ownerId == resource.data.ownerId
      ) || isAdmin();
      allow delete: if (isSignedIn() && resource.data.ownerId == request.auth.uid) || isAdmin();
    }
    match /propertyMediaPrivate/{propertyId} {
      allow read: if (isSignedIn() && resource != null && resource.data.ownerId == request.auth.uid) || isAdmin();
      allow create: if (isSignedIn() && request.resource.data.ownerId == request.auth.uid) || isAdmin();
      allow update: if (
        isSignedIn()
        && resource.data.ownerId == request.auth.uid
        && request.resource.data.ownerId == resource.data.ownerId
      ) || isAdmin();
      allow delete: if (isSignedIn() && resource.data.ownerId == request.auth.uid) || isAdmin();
    }
    match /propertyAdminInternal/{propertyId} {
      allow read, write: if isAdmin();
    }
    match /propertyDocuments/{docId} {
      allow read: if (isSignedIn() && resource != null && resource.data.ownerId == request.auth.uid) || isAdmin();
      allow create: if isSignedIn() && request.resource.data.ownerId == request.auth.uid;
      allow update: if (
        isSignedIn()
        && resource.data.ownerId == request.auth.uid
        && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['verificationStatus', 'adminFeedback'])
      ) || isAdmin();
      allow delete: if (isSignedIn() && resource.data.ownerId == request.auth.uid) || isAdmin();
    }
    match /users/{uid} {
      allow read: if isUser(uid) || isAdmin();
      allow create: if isUser(uid);
      allow update: if isUser(uid) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['adminRole', 'role']);
      allow delete: if isAdmin();
      match /wishlist/{propertyId} {
        allow read, write: if isUser(uid) || isAdmin();
      }
    }
    match /enquiries/{enquiryId} {
      allow read: if isSignedIn() && (
        resource.data.customerId == request.auth.uid ||
        resource.data.buyerId == request.auth.uid ||
        resource.data.ownerId == request.auth.uid ||
        isAdmin()
      );
      allow create: if isSignedIn()
        && (request.resource.data.customerId == request.auth.uid || request.resource.data.buyerId == request.auth.uid)
        && request.resource.data.propertyId is string
        && exists(/databases/$(database)/documents/properties/$(request.resource.data.propertyId))
        && get(/databases/$(database)/documents/properties/$(request.resource.data.propertyId)).data.listingStatus == 'LIVE'
        && get(/databases/$(database)/documents/properties/$(request.resource.data.propertyId)).data.isPublished == true
        && request.resource.data.ownerId == get(/databases/$(database)/documents/properties/$(request.resource.data.propertyId)).data.ownerId;
      allow update: if isSignedIn() && (
        (
          resource.data.ownerId == request.auth.uid
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'updatedAt'])
          && (
            request.resource.data.status == resource.data.status ||
            (resource.data.status == 'SUBMITTED' && request.resource.data.status == 'CONTACTED') ||
            (resource.data.status == 'CONTACTED' && request.resource.data.status == 'IN_PROGRESS') ||
            (resource.data.status == 'IN_PROGRESS' && request.resource.data.status == 'COMPLETED') ||
            (resource.data.status == 'IN_PROGRESS' && request.resource.data.status == 'CLOSED')
          )
        ) ||
        (
          (resource.data.customerId == request.auth.uid || resource.data.buyerId == request.auth.uid)
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'updatedAt'])
          && resource.data.status == 'SUBMITTED'
          && request.resource.data.status == 'CLOSED'
        ) ||
        isAdmin()
      );
      allow delete: if isAdmin();
    }
    match /notifications/{notificationId} {
      allow read: if isSignedIn() && (
        resource.data.recipientId == request.auth.uid ||
        isAdmin()
      );
      allow create: if isAdmin();
      allow update: if isSignedIn() && (
        (
          resource.data.recipientId == request.auth.uid
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read'])
        ) ||
        isAdmin()
      );
      allow delete: if isAdmin();
    }
    match /verificationRecords/{verificationId} {
      allow read: if (isSignedIn() && resource != null && resource.data.ownerId == request.auth.uid) || isAdmin();
      allow write: if isAdmin();
    }
    match /activityLogs/{logId} {
      allow read: if isAdmin();
      allow create: if isAdmin();
      allow update, delete: if false;
    }
    match /siteManagement/{moduleId} {
      allow read: if (resource != null && resource.data.state == 'PUBLISHED') || isAdmin();
      allow write: if isAdmin();
    }
    match /deals/{dealId} {
      allow read: if isSignedIn() && (
        resource.data.ownerId == request.auth.uid ||
        resource.data.buyerId == request.auth.uid ||
        isAdmin()
      );
      allow write: if isAdmin();
    }
    match /followUps/{followUpId} {
      allow read: if isSignedIn() && (
        resource.data.ownerId == request.auth.uid ||
        resource.data.customerId == request.auth.uid ||
        isAdmin()
      );
      allow write: if isAdmin();
    }
    match /reports/{reportId} {
      allow read: if (isSignedIn() && resource.data.reporterId == request.auth.uid) || isAdmin();
      allow create: if isSignedIn() && request.resource.data.reporterId == request.auth.uid;
      allow update, delete: if isAdmin();
    }
  }
}
`;

export const storageRules = `
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isSignedIn() { return request.auth != null; }
    function isAdmin() {
      return isSignedIn() && request.auth.token.keys().hasAll(['adminRole']) && request.auth.token.adminRole != null;
    }
    match /public_media/properties/{propertyId}/{allPaths=**} {
      allow read: if true;
      allow write: if isSignedIn() && (
        (request.resource != null && request.resource.metadata != null && request.resource.metadata.ownerId == request.auth.uid) ||
        isAdmin()
      );
    }
    match /private_docs/properties/{propertyId}/{allPaths=**} {
      allow read: if isSignedIn() && (
        (resource != null && resource.metadata != null && resource.metadata.ownerId == request.auth.uid) ||
        isAdmin()
      );
      allow write: if isSignedIn() && (
        (request.resource != null && request.resource.metadata != null && request.resource.metadata.ownerId == request.auth.uid) ||
        isAdmin()
      );
    }
    match /users/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if isSignedIn() && request.auth.uid == userId;
    }
  }
}
`;
