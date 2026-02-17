# Acceptance Criteria

> Predium v2 — User stories and acceptance criteria organized by feature area.

---

## 1. Authentication

### 1.1 Registration

**As a** new user, **I want to** create an account **so that** I can access the platform.

- [ ] User can register with email, password, first name, and last name
- [ ] Password must meet minimum strength requirements (8+ characters)
- [ ] Confirmation email is sent upon registration
- [ ] Account is inactive until email is confirmed
- [ ] User can select preferred locale (EN/ES) during registration
- [ ] Duplicate email addresses are rejected with a clear error message

### 1.2 Login

**As a** registered user, **I want to** log in **so that** I can access my forms and data.

- [ ] User can log in with email and password
- [ ] "Remember me" option keeps session active across browser closes
- [ ] Failed login shows a generic error (no email enumeration)
- [ ] Successful login redirects to the dashboard
- [ ] User's preferred locale is applied on login

### 1.3 Password Reset

**As a** user who forgot their password, **I want to** reset it **so that** I can regain access.

- [ ] User can request a password reset via email
- [ ] Reset link expires after a configured time period
- [ ] User can set a new password via the reset link
- [ ] Old password is invalidated after reset

### 1.4 Invitation Flow

**As an** org admin, **I want to** invite users **so that** they can join my organization.

- [ ] Org admin can send an invitation email to a new user
- [ ] Invitation email contains a link to set password and complete registration
- [ ] Invited user is automatically added to the inviting organization with `member` role
- [ ] Invitation token expires after a configured time period
- [ ] Re-inviting an existing user who hasn't accepted resends the invitation
- [ ] Inviting an existing confirmed user adds them to the organization directly

---

## 2. Profile

### 2.1 Create/Edit Profile

**As a** user, **I want to** manage my profile **so that** my information is up to date.

- [ ] User can set phone number (free format, no country restriction)
- [ ] User can set professional role (free text: "Farmer", "Extension Agent", etc.)
- [ ] User can set location: country, region, locality (all free text)
- [ ] User can change preferred locale (EN/ES)
- [ ] Profile is created automatically on first access (empty fields allowed)
- [ ] All fields are optional

---

## 3. Form CRUD

### 3.1 Create Draft Form

**As a** user, **I want to** create a new diagnosis form **so that** I can assess a farm.

- [ ] User can create a new form with farm information (name required, other fields optional)
- [ ] Form is created in `draft` state
- [ ] User can set farm location: country, region, locality
- [ ] User can set GPS coordinates (latitude/longitude) — manual entry or device geolocation
- [ ] User can select farming system types (multi-select)
- [ ] User can optionally attach a photo
- [ ] User can optionally select a territory key for extension indicators
- [ ] Form is auto-saved as user fills in fields

### 3.2 Save Progress

**As a** user, **I want to** save my progress on a form **so that** I can continue later.

- [ ] Draft forms persist all entered data (farm info + responses)
- [ ] User can navigate away and return to a draft form
- [ ] Draft forms show a progress indicator (e.g., "15/74 indicators completed")
- [ ] Last modified timestamp is visible

### 3.3 Complete Form

**As a** user, **I want to** mark a form as completed **so that** results are finalized.

- [ ] User can complete a form only when all core indicators have responses
- [ ] Completing a form transitions state from `draft` to `completed`
- [ ] `completed_at` timestamp is recorded
- [ ] Completed forms cannot be edited (scores are locked)
- [ ] Completion triggers availability of results view and PDF generation

### 3.4 View Results

**As a** user, **I want to** view my form results **so that** I can understand the farm's diagnosis.

- [ ] Completed form shows a summary with all scores
- [ ] Radar/spider chart displays L1 category scores
- [ ] Bar charts display L2 dimension scores
- [ ] Individual indicator scores are listed by dimension
- [ ] Territory extension scores are displayed separately (if applicable)

### 3.5 Delete Form (Soft)

**As a** user, **I want to** delete a form **so that** I can remove unwanted records.

- [ ] User can delete their own forms (both draft and completed)
- [ ] Deletion is soft — `discarded_at` timestamp is set
- [ ] Deleted forms do not appear in the user's form list
- [ ] Super admins can view/restore soft-deleted forms

### 3.6 List Forms

**As a** user, **I want to** see all my forms **so that** I can manage my diagnoses.

- [ ] Dashboard shows a list of user's forms (excluding soft-deleted)
- [ ] List shows: farm name, state (draft/completed), date, location
- [ ] Forms are sorted by most recently updated
- [ ] User can filter by state (draft/completed)
- [ ] User can search by farm name

---

## 4. Questionnaire Flow

### 4.1 Level 1 Entry

**As a** user filling out a form, **I want to** see the 6 top-level categories **so that** I know the assessment structure.

- [ ] Form shows 6 Level-1 categories with their names (translated)
- [ ] Each L1 category shows the number of L2 indicators it contains
- [ ] User can navigate to any L1 category to fill in its indicators
- [ ] L1 scores are calculated as averages of their L2 indicators (not directly entered)

### 4.2 Level 2 Entry by Dimension

**As a** user, **I want to** score indicators within a dimension **so that** I can assess each aspect of the farm.

- [ ] Each dimension shows its indicators with translated labels
- [ ] Each indicator has a scoring guide: descriptions for low, medium, and high values (translated)
- [ ] User selects a score from 1 to 10 for each indicator
- [ ] Scores are validated: integer values between 1 and 10 only
- [ ] Progress within the dimension is shown (e.g., "3/5 indicators scored")
- [ ] User can navigate between dimensions without losing data

### 4.3 Territory Extensions

**As a** user in a specific territory, **I want to** answer additional territory-specific indicators **so that** my assessment includes local context.

- [ ] If a `territory_key` is set on the form, additional indicators appear
- [ ] Extension indicators are visually distinguished from core indicators
- [ ] Extension indicators are optional — form can be completed without them
- [ ] Extension scores are flagged as `is_extension: true` in responses
- [ ] Extension scores do not affect core L1/L2 calculations

### 4.4 Validation

**As a** user, **I want to** see validation feedback **so that** I know what's missing before completing.

- [ ] Attempting to complete with missing core indicators shows which are unanswered
- [ ] Invalid scores (outside 1–10) are rejected inline
- [ ] Validation messages are translated

---

## 5. Offline Mode

### 5.1 Create/Edit Forms Offline

**As a** user without internet, **I want to** create and edit forms **so that** I can work in the field.

- [ ] User can create a new form while offline
- [ ] Questionnaire config is available offline (cached in IndexedDB)
- [ ] User can fill in farm info and score indicators offline
- [ ] All data is stored in IndexedDB
- [ ] Form auto-save works offline

### 5.2 View Saved Forms Offline

**As a** user without internet, **I want to** view my saved forms **so that** I can review past work.

- [ ] Previously synced forms are available offline
- [ ] Form list shows all locally stored forms
- [ ] User can view results/scores of completed forms offline
- [ ] Charts render offline (Vega-Lite specs cached locally)

### 5.3 Sync When Online

**As a** user returning online, **I want to** sync my offline changes **so that** my data is backed up.

- [ ] Pending changes sync automatically when connectivity returns (Background Sync API)
- [ ] Manual "Sync Now" button available as fallback
- [ ] Sync status shows: number of pending changes, last sync time
- [ ] Successful sync updates `synchronized_at` on affected forms
- [ ] Failed sync items remain in queue with retry

### 5.4 Conflict Resolution

**As a** user, **I want to** resolve sync conflicts **so that** no data is lost.

- [ ] Completed forms: server version wins (authoritative after completion)
- [ ] Draft forms: client version wins with user confirmation dialog
- [ ] Conflicts surface a notification to the user
- [ ] User can review both versions before confirming resolution

### 5.5 Offline Indicator

**As a** user, **I want to** know my connectivity status **so that** I understand sync behavior.

- [ ] UI shows a clear online/offline indicator (e.g., in the navbar)
- [ ] Indicator shows number of unsynced changes when offline
- [ ] Transitioning online triggers sync and updates the indicator

---

## 6. Charts

### 6.1 Radar/Spider Chart (L1)

**As a** user viewing results, **I want to** see a radar chart **so that** I can quickly assess overall farm health.

- [ ] Radar chart displays all 6 L1 category scores
- [ ] Axes are labeled with translated category names
- [ ] Scores range from 0 (center) to 10 (edge)
- [ ] Chart is responsive and readable on mobile

### 6.2 Bar Charts (L2 Dimensions)

**As a** user viewing results, **I want to** see bar charts for each dimension **so that** I can drill into specific areas.

- [ ] Horizontal bar chart for each L2 dimension
- [ ] Bars show individual indicator scores within the dimension
- [ ] Bars are labeled with translated indicator names
- [ ] Color coding indicates score level (low/medium/high)

### 6.3 Comparison View

**As a** user with multiple forms, **I want to** compare results **so that** I can track changes over time.

- [ ] User can select 2+ completed forms for comparison
- [ ] Overlay radar charts show L1 scores from each selected form
- [ ] Side-by-side or grouped bar charts for L2 comparison
- [ ] Forms are distinguished by color/label

---

## 7. PDF Generation

### 7.1 Generate PDF Report

**As a** user with a completed form, **I want to** generate a PDF **so that** I can share results offline.

- [ ] "Generate PDF" button appears on completed form results page
- [ ] PDF is generated in the background (not blocking)
- [ ] User is notified when PDF is ready (Turbo Stream update)
- [ ] PDF is attached to the form via Active Storage
- [ ] User can download the PDF

### 7.2 PDF Content

**As a** user, **I want** the PDF to contain a complete diagnosis summary **so that** it's useful standalone.

- [ ] Header: farm name, farmer name, location, date of assessment
- [ ] Radar/spider chart for L1 scores (embedded as PNG)
- [ ] Bar charts for L2 dimensions (embedded as PNG)
- [ ] Score table: all indicators with their values, grouped by dimension
- [ ] Territory extension scores in a separate section (if applicable)
- [ ] Footer: generation date, Predium branding
- [ ] PDF renders correctly in standard PDF viewers

---

## 8. Admin Panel

### 8.1 Super Admin — User Management

**As a** super admin, **I want to** manage all users **so that** I can administer the platform.

- [ ] View list of all users with search and filters
- [ ] View user details: profile, forms count, organization memberships
- [ ] Change user's platform role (promote to super admin / demote)
- [ ] Disable/enable user accounts
- [ ] View and restore soft-deleted forms

### 8.2 Super Admin — Organization Management

**As a** super admin, **I want to** manage organizations **so that** I can oversee platform usage.

- [ ] View list of all organizations
- [ ] View org details: members, member roles, forms count
- [ ] Create new organizations
- [ ] Edit organization name

### 8.3 Super Admin — Aggregated Data

**As a** super admin, **I want to** view aggregated data **so that** I can understand platform-wide trends.

- [ ] Dashboard shows total users, organizations, forms (by state)
- [ ] Aggregated charts: average scores by indicator across all forms
- [ ] Filter aggregated data by country, region, territory, date range
- [ ] Export aggregated data to CSV

### 8.4 Org Admin — Member Management

**As an** org admin, **I want to** manage my org's members **so that** I can control access.

- [ ] View list of org members with their roles
- [ ] Invite new members by email
- [ ] Change member roles (promote to admin / demote to member)
- [ ] Remove members from the organization
- [ ] View aggregate form data for the organization

---

## 9. I18n

### 9.1 Locale Switching

**As a** user, **I want to** switch between English and Spanish **so that** I can use the app in my language.

- [ ] User can change locale in profile settings
- [ ] Locale preference persists across sessions
- [ ] All UI elements update immediately on locale change
- [ ] New users default to English unless browser prefers Spanish

### 9.2 Content Translation

**As a** user, **I want** all content in my chosen language **so that** the app is fully usable.

- [ ] Navigation, buttons, labels, and flash messages are translated
- [ ] Questionnaire indicator names and descriptions are translated
- [ ] Scoring criteria (low/medium/high descriptions) are translated
- [ ] Error and validation messages are translated
- [ ] Email templates (confirmation, reset, invitation) are translated
- [ ] PDF report content respects the form creator's locale

---

## Deferred to v2.1

The following features are explicitly **out of scope** for v2.0:

- **Activity Plans** — Action plan creation and management after diagnosis
- **Activity Plan PDF** — Separate PDF generator for action plans
- **Real-time Collaboration** — Multiple users editing the same form simultaneously
- **API Access** — Public REST/GraphQL API for external integrations
- **Additional Locales** — Beyond EN/ES (architecture supports it, content not yet translated)
- **Mobile Native App** — PWA approach for v2.0; native wrapper considered for v2.1
- **Advanced Reporting** — Cross-organization comparative analytics, benchmarking
