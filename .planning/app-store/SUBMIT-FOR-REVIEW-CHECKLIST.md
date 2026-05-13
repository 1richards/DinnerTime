# Submit for Review — Pre-Flight Checklist

Run through this before clicking **Submit for Review** in App Store Connect. Every item is something Apple either checks programmatically or that a reviewer will look at in the first 5 minutes. Catching a problem here saves 24-72 hours of rejection round-trips.

**Last updated:** 2026-05-12 (anchored to build #13 sub).

---

## Hard blockers (fix before submitting)

### 1. ⚠️ Custom Camera + Photo Library usage-description strings
**Risk:** Apple Guideline 5.1.1(i) — generic purpose strings on privacy-sensitive permissions are a known rejection vector.

**Current state:** `apps/mobile/app.json` declares custom strings for Microphone, Speech Recognition, and Face ID, but **does NOT declare** `NSCameraUsageDescription` or `NSPhotoLibraryUsageDescription`. The `expo-image-picker` plugin auto-injects generic Expo defaults like "Allow $(PRODUCT_NAME) to access your camera." These can pass review but are a flagged risk.

**Recommended fix (5-minute change, single commit, requires a new build):**

Edit `apps/mobile/app.json`, inside the `ios.infoPlist` block, add:

```json
"NSCameraUsageDescription": "DinnerTime uses the camera to scan your fridge, pantry, or grocery receipts so the AI can recognize ingredients and suggest dinners.",
"NSPhotoLibraryUsageDescription": "DinnerTime uses your photo library to import existing pantry or recipe photos so you can add them without retaking."
```

Then rebuild + resubmit. This is the single highest-leverage change for review success.

### 2. ⚠️ `applinks:dinnertime.app` references a domain you don't own
**Risk:** Low blast radius (iOS only consults the AASA file if you navigate to a `https://dinnertime.app` URL, which we don't), but Apple has historically flagged third-party domain references in `associatedDomains` as a "your app falsely claims to handle URLs you don't control" issue.

**Recommended fix:** Remove the entire `associatedDomains` block from `apps/mobile/app.json` until DinnerTime owns a real domain. Bundle it with fix #1 in one rebuild.

```json
// DELETE these three lines from ios.infoPlist:
"associatedDomains": [
  "applinks:dinnertime.app"
],
```

---

## App Store Connect submission form — must be filled

### App Information tab
- [ ] **Name:** DinnerTime
- [ ] **Subtitle:** "Snap your fridge. Get dinner." (30-char limit; verify exact wording from [`description.md`](./description.md))
- [ ] **Category:** Primary: Food & Drink — Secondary: Lifestyle
- [ ] **Age Rating:** 4+ (no questionable content, no UGC, no third-party advertising)
- [ ] **Privacy Policy URL:** (already hosted — confirm the link resolves before submitting)
- [ ] **Support URL:** (already hosted — confirm the link resolves before submitting)
- [ ] **Marketing URL:** leave blank (optional)

### App Privacy (data collection form)
Use [`privacy-manifest.json`](./privacy-manifest.json) as the source of truth. Key answers:
- [ ] Data linked to user: **email_address, user_id, photos, other_user_content, product_interaction**
- [ ] Data NOT linked to user: none
- [ ] Data used for tracking: **none**
- [ ] Purposes — App Functionality: email, user_id, photos, other_user_content
- [ ] Purposes — Analytics: product_interaction, crash_data, performance_data, other_diagnostic_data

### Pricing and Availability
- [ ] **Price:** Free
- [ ] **Availability:** all countries (or your chosen subset)

### Version Information
- [ ] **Description:** paste from [`description.md`](./description.md)
- [ ] **Keywords:** paste from [`keywords.txt`](./keywords.txt)
- [ ] **Promotional text:** paste from [`description.md`](./description.md) (170-char field)
- [ ] **Support URL:** (mirrors App Information tab)
- [ ] **Marketing URL:** leave blank
- [ ] **What's New in This Version:** "Initial release." (or whatever pre-release notes you want)

### Screenshots
- [ ] **6.9" (iPhone 17 Pro Max):** 5 PNGs at 1320×2868 → [`screenshots/`](./screenshots/)
- [ ] **6.5" (iPhone 11 Pro Max):** 5 PNGs at 1242×2688 → [`screenshots/`](./screenshots/)
- [ ] **No status-bar artifacts, no debug banners, no seed-data emails visible** (per [`screenshots-shotlist.md`](./screenshots-shotlist.md) QA notes)

### Build
- [ ] Latest TestFlight build selected (build #13 or newer after the camera-string fix)
- [ ] Build has finished Apple processing before you can select it for the version

### App Review Information
- [ ] **Sign-in required:** YES
- [ ] **Demo account credentials:** `uat@dinnertime.test` / `UATovernight2026`
- [ ] **Notes:** paste from [`APP-REVIEW-NOTES-SHORT.md`](./APP-REVIEW-NOTES-SHORT.md)
- [ ] **Attachment:** [`APP-REVIEW-NOTES.pdf`](./APP-REVIEW-NOTES.pdf) (convert the markdown version via Preview "Export as PDF" or any markdown-to-PDF tool)
- [ ] **Contact info:** patrickrrichards@gmail.com (you'll get questions here directly)

### Export Compliance
- [ ] **Does your app use encryption?** No
  - (We declared `ITSAppUsesNonExemptEncryption: false` in Info.plist. Standard HTTPS + Keychain + AES-CTR local cache fall under exemption.)

### Content Rights / Advertising Identifier
- [ ] **Content rights:** No (no third-party content rights to declare)
- [ ] **Uses Advertising Identifier (IDFA):** No

### Version Release
- [ ] **Release schedule:** "Manually release this version" (recommended — gives you control to time the launch announcement)
  - The alternatives are "Automatically release after approval" or "Automatically release after X date." Pick manual unless you have a specific reason otherwise.

---

## Sanity-checks before clicking Submit

- [ ] **TestFlight smoke test on a real device:** sign in fresh with the UAT account, walk through the 5-min reviewer flow yourself. If anything breaks, fix it; don't submit known-broken code.
- [ ] **TestFlight smoke test on a fresh-account flow:** create an account with Apple Sign-In and complete the 3-step onboarding. Verify you can complete onboarding and reach the Kitchen tab.
- [ ] **Sentry dashboard:** no unresolved errors in the latest TestFlight session. (Sentry DSN is wired to production — `EXPO_PUBLIC_SENTRY_DSN` in `eas.json` production env.)
- [ ] **Supabase Auth → Email Templates:** confirm the branded HTML for "Confirm signup" is saved and the subject is "Confirm your DinnerTime account."
- [ ] **Supabase Auth → URL Configuration → Site URL:** set to a real URL that returns a sensible page (your Privacy Policy host works). Default `localhost:3000` makes confirmation-link clicks fail in Safari for the user.
- [ ] **Supabase Auth → Providers → Apple:** enabled with `com.dinnertime.app` listed under Client IDs.
- [ ] **Privacy Policy URL** opens in a browser and shows the actual policy
- [ ] **Support URL** opens and shows actual contact info

---

## After submission

Apple's review SLA in 2026 is **24-48 hours for the first review** of a new app (down from 5-7 days historically). Be prepared to:

1. **Respond to reviewer questions within hours.** Apple closes the review window quickly if questions go unanswered.
2. **Have a fix ready if rejected.** Common rejection reasons for v1 indie apps: missing custom permission strings (Section 1 above), unclear demo flow (Section 3 of APP-REVIEW-NOTES.md addresses this), and "feature requires login but no demo provided" (the demo account in Section 2 addresses this).
3. **Don't resubmit on autopilot.** If rejected, read the reviewer's message carefully — they typically include reproduction steps. Fix exactly what they cited, write a clear reply explaining the fix, and resubmit. Multiple rejections without clear responses to the reviewer's points create friction.

If approved, the app moves to "Pending Developer Release" if you chose manual release. Click **Release This Version** when ready for public availability.

---

## Recommended order of operations

1. Apply the camera/photo-library permission strings fix (10 min)
2. Strip `associatedDomains` (1 min, same commit)
3. Build + submit to TestFlight (build #14)
4. Smoke-test build #14 on a real device against the 5-min reviewer flow
5. Confirm Supabase configuration items (template, Site URL, Apple provider)
6. Convert `APP-REVIEW-NOTES.md` to PDF (Preview → File → Export as PDF, or `pandoc -o APP-REVIEW-NOTES.pdf APP-REVIEW-NOTES.md`)
7. Fill out every ASC field above
8. Paste the short review notes + attach the PDF
9. Click Submit for Review
10. Watch Sentry + email for the next 48 hours
