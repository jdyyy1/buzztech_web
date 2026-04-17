# Web App Integration Summary

Generated: 2026-04-18
Project: softeng (Android app)

## 1. Project Overview

This project is an Android application for a service marketplace/workflow called BuzzTech.
It supports:

- Client and admin roles
- User authentication (email/password + Google Sign-In)
- Service browsing and booking
- Booking lifecycle with partial payment rules
- GCash checkout via PayMongo
- Notifications (in-app + Firebase messaging/local notification flow)
- Runtime system configuration (maintenance mode, auth/session rules, branding)

The app is a single Android module (`app`) with Java-based activities and Firebase as the primary backend.

## 2. High-Level Architecture

- Frontend: Native Android (Java, XML layouts)
- Backend services: Firebase Auth, Firestore, Firebase Messaging, Firebase Analytics, Firebase App Check
- Payment provider: PayMongo checkout sessions (HTTP via Volley)
- Image/media handling: Glide + uCrop
- Config persistence: Firestore + local SharedPreferences cache

There is no dedicated custom backend server in this repository.

## 3. Core Build and Runtime Details

- Android compileSdk/targetSdk: 35
- minSdk: 31
- Java target: 11
- Firebase BOM + Google Services plugin enabled
- App namespace/applicationId: `com.example.softeng`

Primary dependencies used for integration concerns:

- Firebase Auth
- Firebase Firestore
- Firebase Messaging
- Firebase Analytics
- Firebase App Check (Play Integrity)
- Google Sign-In (`play-services-auth`)
- Volley + Gson

## 4. Package/Module Map

Main package root: `com.example.softeng`

- `UserSide`: client-facing flows (login, signup, dashboard, bookings, payment, profile)
- `AdminSide`: admin management/configuration/audit screens
- `Models`: shared data models (`Booking`, `Payment`, `Service`, `Notification`, `AppConfiguration`)
- `utils`: payment processing, PayMongo API calls, validation/session helpers, notifications
- `managers`: app configuration manager (cache + Firestore sync)
- `services`: Firebase messaging service + dynamic branding helpers
- `Adapters`: RecyclerView adapters for lists

## 5. Authentication and Roles

Authentication methods:

- Firebase email/password
- Google Sign-In -> Firebase credential auth

Role model (stored in Firestore `users` documents):

- `admin`
- `client`

Routing behavior:

- After login, app checks user role from Firestore and redirects to admin/client dashboard
- Maintenance mode blocks non-admin users

Session behavior:

- Local session token stored in SharedPreferences for 30 days (`SessionManager`)

## 6. Firestore Data Model (Observed)

### `users` collection

Document ID: Firebase UID
Common fields used/created:

- `user_id` (string)
- `name` (string)
- `email` (string)
- `password_hash` (string marker like `firebase_auth` or `google_auth`)
- `role` (`admin` or `client`)
- `profile_image` (string URL/base64/empty)
- `status` (string, e.g. `active`)
- `created_at` (timestamp)
- `last_login` (timestamp)

### `services` collection

Document fields used:

- `id`
- `serviceName`
- `category`
- `minPrice`
- `maxPrice`
- `description`
- `iconResName`
- rating-related fields (`rating`, `totalRating`, `projectCount`)

Nested use observed:

- `services/{serviceId}/ratings` subcollection

### `bookings` collection

Document fields from `Booking` model:

- `id`
- `userId`
- `serviceName`
- `serviceId`
- `developerName`
- `developerId`
- `totalAmount`
- `paidAmount`
- `status` (`PENDING`, `ACTIVE`, `COMPLETED`, `CANCELLED`)
- `bookingDate`
- `completionDate`
- `description`
- `timeline`
- `budget`
- `fileAttachments` (migrated handling for older string list format)

Business rule:

- Booking becomes `ACTIVE` once paid amount reaches at least 20% of `totalAmount`

### `payments` collection

Document ID: generated transaction ID
Fields used:

- `paymentId`
- `userId`
- `bookingId`
- `projectName`
- `amount`
- `totalAmount`
- `status` (typically `Paid`)
- `createdAt`
- `balanceDue`

### `notifications` collection

Fields used:

- `id`
- `userId`
- `message`
- `isRead`
- `timestamp`

### `system_config` collection

Document: `app_configuration`
Used by `ConfigurationManager` with fields from `AppConfiguration`:

- Branding: `appLogo`, `appLabel`
- Localization: `defaultLanguage`, `defaultTimezone`, `dateFormat`
- Auth policy: `twoFactorAuthEnabled`, `passwordPattern`, `maxLoginAttempts`, `sessionExpirationMinutes`
- Session policy: `idleTimeoutMinutes`, `warningBeforeTimeoutSeconds`
- Maintenance: `maintenanceModeEnabled`, `maintenanceModeMessage`
- Metadata: `lastModified`, `modifiedBy`

## 7. Payment Integration Flow (Current Android)

1. User enters payment amount in `PaymentActivity`
2. App validates amount and 20% minimum rule
3. App creates PayMongo checkout session via `PayMongoApi` using Volley
4. Checkout URL is opened in Android `WebView`
5. On success callback URL containing `payment_status=success`, app:
   - generates transaction UUID
   - updates booking payment and status
   - writes payment document
   - writes in-app notification document
   - triggers local/payment notification helpers
6. On failed callback (`payment_status=failed`), app returns to payment form

Important callback URLs currently hardcoded in app:

- success: `https://payment.example.com/callback?payment_status=success`
- cancel/fail: `https://payment.example.com/callback?payment_status=failed`

## 8. Web App Integration Opportunities

A web app can integrate at two levels:

### Option A: Shared Firebase-first architecture

- Use Firebase Auth for web sign-in
- Use same Firestore collections (`users`, `services`, `bookings`, `payments`, `notifications`, `system_config`)
- Reuse role-based routing logic (`admin` vs `client`)
- Implement same booking/payment status rules on web

Pros: fastest alignment with current Android architecture.
Cons: payment and sensitive operations still exposed to client unless moved server-side.

### Option B: Introduce backend API (recommended for production)

- Move PayMongo secret-key operations to secure backend/cloud functions
- Keep Firebase for auth/data or move gradually to API-owned writes
- Expose web+mobile-safe endpoints for:
  - create checkout session
  - verify payment result/webhook
  - finalize booking + payment records atomically

Pros: secure key management, cleaner auditability, easier fraud controls.
Cons: additional infrastructure work.

## 9. Security and Integration Risks to Address

1. PayMongo API secret key appears hardcoded in Android client code.
2. Payment success is inferred from callback query string in WebView; this should be server-verified.
3. Firestore writes for payment activation occur client-side; integrity should be protected with rules/server functions.
4. Manifest deep-link hosts use placeholder domains (`example.com`) and may require production domain alignment.
5. Firebase messaging service registration should be verified in manifest for reliable push handling.

## 10. Minimum Web Integration Checklist

1. Define canonical Firestore schema contract (field names/types/defaults).
2. Align role and status enums across Android and web.
3. Build shared validation rules:
   - booking amount constraints
   - 20% activation threshold
4. Replace client-side payment key usage with server-side session creation.
5. Add payment webhook verification and idempotent transaction handling.
6. Align callback URLs and deep-link/web routes with real domain.
7. Confirm/upgrade Firebase security rules for least privilege.
8. Ensure notification strategy for web (in-app list + optional web push).
9. Validate maintenance-mode behavior parity between platforms.
10. Add integration tests for booking -> payment -> activation path.

## 11. Suggested Next Step for This Repo

Create a small integration contract document (JSON schema or OpenAPI-style spec) for:

- Booking
- Payment
- Notification
- User profile/role
- Configuration

Then implement a backend payment proxy (Cloud Functions or separate API) before building the web checkout flow.

## 12. Key Files Reviewed

- `settings.gradle.kts`
- `build.gradle.kts`
- `gradle/libs.versions.toml`
- `app/build.gradle.kts`
- `app/src/main/AndroidManifest.xml`
- `app/src/main/java/com/example/softeng/App.java`
- `app/src/main/java/com/example/softeng/BaseActivity.java`
- `app/src/main/java/com/example/softeng/UserSide/Login.java`
- `app/src/main/java/com/example/softeng/UserSide/SignUp.java`
- `app/src/main/java/com/example/softeng/UserSide/PaymentActivity.java`
- `app/src/main/java/com/example/softeng/utils/PayMongoApi.java`
- `app/src/main/java/com/example/softeng/utils/PaymentProcessor.java`
- `app/src/main/java/com/example/softeng/managers/ConfigurationManager.java`
- `app/src/main/java/com/example/softeng/Models/AppConfiguration.java`
- `app/src/main/java/com/example/softeng/Models/Booking.java`
- `app/src/main/java/com/example/softeng/Models/Payment.java`
- `app/src/main/java/com/example/softeng/Models/Notification.java`
- `app/src/main/java/com/example/softeng/Models/Service.java`
- `app/src/main/res/values/strings.xml`
