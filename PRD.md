# Dorm Marketplace PRD

## 1. Scope Cut

- Payments and escrow: no real money or payment flow will be built because Day 1 must focus on listing and claiming, not finance.
- Live chat or messaging: buyer-seller communication is out of scope because a simple in-person handoff workflow is enough for the prototype.
- User accounts and email verification: skip authentication so the app can stay small and still demonstrate marketplace behavior.

## 2. MVP Features

- Item listings: students can create and publish used-item listings with title, category, description, and pickup location.
- Browse and claim: students can view available items and claim a listing in a way that locks it temporarily.
- Claim lifecycle: claims expire if not confirmed, and sellers can immediately remove or mark items sold.

## 3. Acceptance Criteria

- Given an available listing, when a student clicks Claim Item, then the listing becomes claimed and no other student can claim it until it is resolved.
- Given a claimed listing, when the claiming student does not confirm pickup before the expiration timer ends, then the listing returns to available.
- Given a listing that was sold outside the app, when a seller uses the override action, then the listing is removed or marked sold and is no longer available to claim.
