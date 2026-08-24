## Feature: Native Events, RSVP & QR Attendance

We already have the complete **Church Website Builder platform**, including church accounts, website creation, dashboard, hosting, and church-specific websites.

Do NOT build a separate event-management platform.

Instead, add **Events, RSVP, QR Tickets, and Attendance as a core native module inside the existing website builder**.

The church's website should automatically become the public-facing place where visitors discover events and RSVP.

---

# 1. Core Product Flow

The complete experience should be:

**Church Dashboard**
→ Create Event
→ Event automatically appears on Church Website
→ Visitor opens event
→ Visitor fills RSVP form
→ Registration created
→ Unique QR code generated
→ QR sent to visitor's email
→ Visitor arrives at church
→ Church staff scans QR
→ Attendance automatically recorded
→ Church sees attendance inside dashboard

The event system must feel like a natural extension of the existing website builder.

---

# 2. Events as a Website Section

Add an **Events** section/block to the website builder.

Church admins should be able to add:

* Events page
* Upcoming Events section
* Featured Event section
* Event cards
* Event calendar
* Past Events section

Example website:

`churchname.com/events`

The Events page should automatically pull events created from the church dashboard.

The church admin should NOT have to manually create event pages inside the website builder.

---

# 3. Dynamic Event Pages

Every event created from the dashboard automatically gets a public event page.

Example:

`churchname.com/events/youth-night`

The page should inherit the church website's:

* Logo
* Brand colors
* Typography
* Header
* Footer
* Navigation
* Overall design system

The event page should look like a native part of the church website.

Display:

* Event banner
* Event title
* Description
* Date
* Time
* Location
* Address
* Organizer
* Capacity
* RSVP status
* RSVP CTA

Primary CTA:

**RSVP Now**

---

# 4. Website Builder Integration

Add Events as a first-class content type inside the existing website builder.

For example:

**Website Builder**

* Pages
* Sections
* Navigation
* Blog
* Media
* Forms
* **Events**
* Settings

The Events module should be connected directly to the website rendering system.

If the church creates an event:

**Create Event → Publish**

the event automatically becomes available on:

* Events page
* Homepage event section
* Event detail page
* Search/navigation where configured

---

# 5. Event Blocks

Provide reusable website-builder blocks.

### Upcoming Events

Automatically displays upcoming published events.

### Featured Event

Admin selects one event to highlight.

### Event Grid

Example:

`[Event] [Event] [Event]`

### Event List

Useful for church websites with many events.

### Event Calendar

Monthly/weekly calendar view.

### Past Events

Automatically moves events into past events after their end date.

All blocks should dynamically fetch the church's events.

---

# 6. Event Creation Dashboard

Inside the existing church dashboard:

**Events → Create Event**

Fields:

### Basic

* Event name
* Description
* Cover image
* Date
* Start time
* End time
* Location
* Address
* Event category
* Organizer

### Registration

* Enable RSVP
* Maximum capacity
* Registration deadline
* Enable waitlist
* Allow guests
* Registration status

### RSVP Form

Church can select/create the fields required for registration.

Default:

* Full Name
* Email
* Phone

Optional custom fields:

* Number of guests
* Age
* Small group
* Dietary requirements
* Prayer request
* Custom questions

---

# 7. Event Publishing

Event status:

* Draft
* Published
* Registration Closed
* Event Completed
* Cancelled

Only **Published** events should appear publicly on the church website.

When an event is published:

**Automatically publish it to the church website.**

When unpublished:

**Automatically remove it from public event listings.**

---

# 8. RSVP Experience

Visitor comes to:

`churchname.com/events/event-name`

Clicks:

**RSVP Now**

The RSVP form should open directly on the website.

Do not redirect users to a third-party event platform.

The RSVP experience must remain completely inside the church website.

After submission:

1. Validate registration
2. Create registration
3. Generate unique QR code
4. Show confirmation
5. Send confirmation email

---

# 9. RSVP Confirmation

After successful registration:

### You're Registered!

Show:

* Attendee name
* Event
* Date
* Time
* Location
* QR code
* Registration ID

Actions:

**Add to Calendar**

**View RSVP**

The QR code should be downloadable/savable.

---

# 10. Email QR Ticket

Automatically send the attendee an email.

Email contains:

* Church branding
* Event details
* Attendee details
* QR code
* Registration ID
* Event location
* Check-in instructions

The QR code must contain a secure registration/token identifier.

Do NOT expose sensitive attendee data inside the QR code.

---

# 11. QR Check-in

Add a **Scan QR** feature inside the existing church dashboard.

Church staff/volunteers can open the dashboard from their phone.

Flow:

**Open Dashboard → Scan QR → Camera → Scan → Validate → Check In**

Successful scan:

### ✓ Checked In

Show:

* Attendee name
* Event name
* Check-in time

If already checked in:

### Already Checked In

Show previous check-in time.

Invalid QR:

### Invalid Registration

---

# 12. Volunteer Mode

Existing church admins should be able to create/invite volunteers.

Volunteer permissions should be limited to:

* View assigned events
* Scan QR
* Check attendees in

They should NOT have access to:

* Website settings
* Billing
* Church account settings
* Other sensitive data

---

# 13. Live Attendance

Inside:

**Dashboard → Events → Event → Attendance**

Show:

### Attendance

**342 Registered**

**287 Checked In**

**55 Not Checked In**

**83.9% Attendance**

Live attendance should update immediately when QR codes are scanned.

---

# 14. Attendee Management

Each event should have an attendee table.

Columns:

* Name
* Email
* Phone
* Registration date
* RSVP status
* Check-in status
* Check-in time

Actions:

* Search
* Filter
* Manual check-in
* Export CSV

---

# 15. Church-Level Attendee History

Do not treat every RSVP as an isolated person.

If the same visitor registers for multiple events using the same email/phone, maintain their attendee history.

Example:

**John Smith**

Registered:

* Youth Night
* Christmas Service
* Men's Conference
* Easter Service

Attended:

* Youth Night
* Christmas Service
* Easter Service

This creates a reusable church attendee database.

---

# 16. Homepage Integration

Church admins should be able to add dynamic event sections to their existing website.

Example:

### Upcoming Events

Youth Night
August 30 · 7:00 PM

Sunday Service
September 1 · 10:00 AM

Community Outreach
September 5 · 5:00 PM

Each card automatically links to the corresponding event page.

The website builder should allow the admin to control:

* Number of events displayed
* Layout
* Grid/list
* Featured event
* Categories
* Event sorting

---

# 17. Event Categories

Allow churches to categorize events:

* Sunday Service
* Bible Study
* Youth
* Worship
* Prayer
* Conference
* Community
* Kids
* Outreach
* Special Events

Categories can be customized per church.

---

# 18. Website Theme Compatibility

Events must automatically respect the existing website builder theme.

If the church changes:

* Colors
* Fonts
* Border radius
* Buttons
* Header
* Footer
* Theme

the event pages and event blocks should automatically update.

Do NOT create a separate event-page design system.

Use the existing website design system.

---

# 19. PWA

The entire existing church platform should remain installable as a PWA.

The church admin can add the platform to their phone home screen and use:

* Dashboard
* Events
* RSVP management
* QR scanner
* Attendance

The public church website remains accessible normally through the browser.

---

# 20. Notifications

Add automated notifications to the existing notification infrastructure.

### Attendee

* RSVP confirmation
* QR ticket
* Event reminder
* Event update
* Event cancellation

### Church

* New RSVP
* Event capacity reached
* Registration deadline
* Attendance summary

---

# 21. Important Architecture Rule

Events should belong to the existing **Church/Tenant**.

Conceptually:

**Church**
→ Website
→ Pages
→ Events
→ Registrations
→ Attendees
→ Check-ins

Do NOT create a separate organization/product architecture for Events.

The existing church tenant should remain the source of truth.

---

# 22. Public Website API / Rendering

The website renderer should be able to query:

* Published events
* Featured events
* Upcoming events
* Event categories
* Event details
* RSVP availability

Example:

`GET /api/public/events`

`GET /api/public/events/:slug`

`POST /api/public/events/:id/rsvp`

The public APIs must only expose data intended for the public website.

---

# 23. Admin APIs

Existing authenticated church dashboard APIs should support:

* Create event
* Update event
* Delete event
* Publish/unpublish
* Manage RSVP form
* View registrations
* Generate/export attendee data
* Scan/check-in
* Attendance analytics

---

# 24. Database Concepts

Extend the existing schema rather than creating an isolated application.

Core entities:

**Church**
→ Event

**Event**
→ RSVP Form

**Event**
→ Registration

**Registration**
→ Attendee

**Registration**
→ QR Token

**Registration**
→ Check-in

**Attendee**
→ Registration History

Ensure every entity is scoped to the correct church/tenant.

---

# 25. MVP

Build these first:

### Phase 1

* Event CRUD
* Event publishing
* Public event pages
* Events website section
* Homepage upcoming-events block

### Phase 2

* RSVP forms
* Registration
* QR generation
* Confirmation email

### Phase 3

* QR scanner
* Check-in
* Attendance dashboard
* Manual check-in

### Phase 4

* Attendee history
* Volunteer roles
* Analytics
* Reminders

---

# Final Product Experience

The product should ultimately feel like:

**"Your church website now has its own built-in Eventbrite-style event system."**

But the church should never feel like they're using a second product.

The experience is:

**Build Church Website**
↓
**Add Events Section**
↓
**Create Event in Dashboard**
↓
**Event Automatically Appears on Website**
↓
**Visitor RSVPs**
↓
**QR Automatically Sent**
↓
**Visitor Comes to Church**
↓
**Volunteer Scans QR**
↓
**Attendance Automatically Recorded**
↓
**Church Sees Live Attendance**

This should be implemented as a **core module of the existing website builder**, sharing the existing authentication, church tenant, website theme, CMS, dashboard, hosting, and infrastructure.
