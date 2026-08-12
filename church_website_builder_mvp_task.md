# Church Website Builder --- MVP Engineering Task Specification

## 1. Project Goal

Build a **multi-tenant-ready church website builder MVP** using Next.js,
TypeScript, Tailwind CSS, and PostgreSQL.

The MVP is intentionally **NO AUTH**.

The goal is to build the complete website-generation pipeline first:

1.  User enters church information.
2.  User creates a brand canvas.
3.  User selects functional features.
4.  System generates/recommends 1--2 website templates using
    deterministic rules and an AI-ready abstraction.
5.  User previews the templates with their real brand.
6.  User selects a template.
7.  System generates a complete website configuration.
8.  User can preview and edit the generated website.
9.  User can publish it.
10. Published sites are available through:

-   `<slug>.regroup.app`
-   future custom domains

11. Architecture must be designed so authentication, billing, custom
    domains, CMS, AI generation, and team management can be added later
    without rewriting the website engine.

## 2. Important Architecture Decision

**DO NOT generate a separate Next.js application or Vercel deployment
for every church.**

Use:

``` text
One Next.js application
        |
        +-- Site A configuration
        +-- Site B configuration
        +-- Site C configuration
        +-- Site N configuration
```

Every website is rendered from:

``` text
Site Config
    +
Template
    +
Theme
    +
Content
    +
Feature Flags
```

AI should generate structured configuration, **not React/Next.js source
code**.

------------------------------------------------------------------------

# 3. Scope of This MVP

## In Scope

-   Church onboarding
-   Church information
-   Brand canvas
-   Logo upload
-   Favicon upload
-   Primary/secondary colors
-   Primary/secondary fonts
-   Tagline
-   Social media URLs
-   YouTube channel input
-   Podcast RSS feed input
-   Sermon functionality toggle
-   Sermon search toggle
-   Events functionality toggle
-   Template recommendation
-   Two template previews
-   Template selection
-   Config-driven website renderer
-   Reusable section components
-   Theme engine
-   Feature flag engine
-   Draft website
-   Preview website
-   Publish website
-   Slug/subdomain-ready routing
-   PostgreSQL persistence
-   Seed templates
-   Sample content
-   Basic website editor
-   Responsive design
-   SEO metadata
-   404 handling
-   Error states
-   Loading states

## Explicitly Out of Scope

Do NOT implement these in this MVP:

-   User authentication
-   Organization/team members
-   Role-based permissions
-   Billing
-   Stripe
-   Subscription plans
-   Email verification
-   Password reset
-   OAuth
-   Custom domain provisioning
-   Vercel domain API integration
-   Full CMS
-   Advanced media library
-   Production podcast synchronization workers
-   YouTube API synchronization
-   Advanced sermon transcription
-   Advanced search infrastructure
-   Analytics
-   AI-generated React code
-   Drag-and-drop page builder

However, interfaces and database structures should make future
implementation straightforward.

------------------------------------------------------------------------

# 4. Recommended Stack

## Core

-   Next.js
-   TypeScript
-   React
-   Tailwind CSS
-   shadcn/ui
-   PostgreSQL
-   Prisma ORM
-   Zod
-   React Hook Form

## State / Data

Prefer:

-   Server Components for website rendering
-   Server Actions or route handlers for mutations
-   React state only where interactive UI is required

Do not introduce Redux unless there is a concrete need.

## Storage

Create an abstraction:

``` ts
StorageProvider
```

For MVP, support a local/mock provider or a simple configured
object-storage provider.

The application must not hardcode storage logic inside UI components.

Future providers can be:

-   Vercel Blob
-   AWS S3
-   Cloudflare R2

------------------------------------------------------------------------

# 5. Project Structure

Use a scalable structure similar to:

``` text
app/
├── (platform)/
│   ├── page.tsx
│   ├── onboarding/
│   │   ├── page.tsx
│   │   ├── church/
│   │   ├── brand/
│   │   ├── features/
│   │   ├── templates/
│   │   └── publish/
│   │
│   └── builder/
│       └── [siteId]/
│           ├── page.tsx
│           ├── settings/
│           ├── brand/
│           ├── features/
│           ├── pages/
│           └── preview/
│
├── sites/
│   └── [siteSlug]/
│       ├── page.tsx
│       ├── about/
│       ├── sermons/
│       ├── events/
│       └── ...
│
├── api/
│   ├── sites/
│   ├── uploads/
│   ├── templates/
│   └── preview/
│
└── globals.css

components/
├── builder/
├── onboarding/
├── website/
│   ├── sections/
│   ├── layouts/
│   └── renderer/
├── templates/
├── theme/
└── ui/

lib/
├── db/
├── site/
├── templates/
├── features/
├── theme/
├── storage/
├── domains/
├── validation/
└── ai/

prisma/
├── schema.prisma
└── seed.ts

packages/ (if using monorepo)
├── website-engine/
├── templates/
├── ui/
├── theme/
├── database/
└── validation/
```

Do not over-engineer the monorepo if this is currently a single
application. Keep boundaries clear so extraction into packages later is
easy.

------------------------------------------------------------------------

# 6. Core Domain Model

The most important entity is:

``` text
Site
```

A Site represents one church website.

For the MVP, use:

``` text
Site
├── Church information
├── Brand configuration
├── Feature configuration
├── Template configuration
├── Navigation
├── Section configuration
├── SEO configuration
├── Content
└── Publishing state
```

------------------------------------------------------------------------

# 7. Prisma Data Model

Implement the following models.

## Site

``` prisma
model Site {
  id                String   @id @default(cuid())
  name              String
  slug              String   @unique
  denomination      String?
  congregationSize  Int?

  primaryContactName  String?
  primaryContactEmail String?
  primaryContactPhone String?

  tagline           String?

  status            SiteStatus @default(DRAFT)

  brandConfig       Json
  featureConfig     Json
  navigationConfig  Json
  sectionConfig     Json
  seoConfig         Json

  templateId        String
  templateVersion   Int      @default(1)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  publishedAt       DateTime?

  socialLinks       SocialLink[]
  media             Media[]
  sermons           Sermon[]
  events            Event[]
}
```

## SocialLink

``` prisma
model SocialLink {
  id        String @id @default(cuid())
  siteId    String
  platform  String
  url       String
  createdAt DateTime @default(now())

  site Site @relation(fields: [siteId], references: [id], onDelete: Cascade)

  @@index([siteId])
}
```

## Media

``` prisma
model Media {
  id        String   @id @default(cuid())
  siteId    String
  type      MediaType
  url       String
  altText   String?
  filename  String?
  createdAt DateTime @default(now())

  site Site @relation(fields: [siteId], references: [id], onDelete: Cascade)

  @@index([siteId])
}
```

## Sermon

``` prisma
model Sermon {
  id           String   @id @default(cuid())
  siteId       String
  title        String
  slug         String
  description  String?
  speaker      String?
  series       String?
  date         DateTime
  videoUrl     String?
  audioUrl     String?
  thumbnailUrl String?
  transcript   String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  site Site @relation(fields: [siteId], references: [id], onDelete: Cascade)

  @@unique([siteId, slug])
  @@index([siteId, date])
}
```

## Event

``` prisma
model Event {
  id               String   @id @default(cuid())
  siteId           String
  title            String
  slug             String
  description      String?
  startAt          DateTime
  endAt            DateTime?
  location         String?
  imageUrl         String?
  registrationUrl  String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  site Site @relation(fields: [siteId], references: [id], onDelete: Cascade)

  @@unique([siteId, slug])
  @@index([siteId, startAt])
}
```

## Template

Templates should be database-seeded but their rendering definitions can
live in code.

``` prisma
model Template {
  id          String   @id
  name        String
  description String?
  category    String?
  version     Int      @default(1)
  metadata    Json
  createdAt   DateTime @default(now())
}
```

## Enums

``` prisma
enum SiteStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum MediaType {
  LOGO
  FAVICON
  IMAGE
  VIDEO
  OTHER
}
```

Do not create an unnecessary User model for this MVP.

------------------------------------------------------------------------

# 8. Brand Canvas

Create a strongly typed brand configuration.

``` ts
export interface BrandConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    foreground: string;
    accent: string;
  };

  typography: {
    primaryFont: string;
    secondaryFont: string;
  };

  logo: {
    url: string;
    alt: string;
  };

  favicon: {
    url: string;
  };

  tagline?: string;
}
```

Validate all colors using Zod.

Example:

``` ts
const brandConfigSchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    background: z.string(),
    foreground: z.string(),
    accent: z.string(),
  }),
  typography: z.object({
    primaryFont: z.string(),
    secondaryFont: z.string(),
  }),
  logo: z.object({
    url: z.string(),
    alt: z.string(),
  }),
  favicon: z.object({
    url: z.string(),
  }),
  tagline: z.string().optional(),
});
```

------------------------------------------------------------------------

# 9. Feature System

This is a first-class part of the architecture.

Create:

``` ts
export interface FeatureConfig {
  sermons: boolean;
  sermonSearch: boolean;
  events: boolean;
  youtube: boolean;
  podcast: boolean;
  giving: boolean;
  ministries: boolean;
  contact: boolean;
}
```

Initial defaults:

``` ts
const defaultFeatures: FeatureConfig = {
  sermons: true,
  sermonSearch: false,
  events: true,
  youtube: false,
  podcast: false,
  giving: false,
  ministries: false,
  contact: true,
};
```

## Feature Dependencies

Implement dependency validation.

For example:

``` text
sermonSearch requires sermons
```

Therefore:

``` ts
if (features.sermonSearch && !features.sermons) {
  throw new Error("Sermon search requires sermons");
}
```

Likewise:

``` text
youtube = false
```

means YouTube sections should not render.

------------------------------------------------------------------------

# 10. Onboarding Questions

Build a multi-step onboarding UI.

## Step 1 --- Church Information

Fields:

-   Church name
-   Denomination
-   Congregation size
-   Primary contact name
-   Primary contact email
-   Primary contact phone
-   Tagline

## Step 2 --- Social Media

Fields:

-   Facebook
-   Instagram
-   YouTube
-   X
-   TikTok

Only store non-empty URLs.

Validate URL format.

## Step 3 --- Brand

Fields:

-   Primary color picker
-   Secondary color picker
-   Logo upload
-   Favicon upload
-   Primary font
-   Secondary font
-   Tagline

Show a live mini brand preview.

## Step 4 --- Functional Features

Ask:

``` text
Do you have a YouTube channel or podcast RSS feed?
```

Allow:

``` text
YouTube channel
Podcast RSS
Both
Neither
```

Then:

``` text
Do you want sermon search functionality on your site?
```

Then:

``` text
Do you want an event section?
```

Also support:

-   Sermons
-   Giving
-   Ministries
-   Contact

The UI should make it obvious that these answers control the generated
website.

## Step 5 --- Template Recommendation

Generate 1--2 recommended templates.

## Step 6 --- Template Selection

Show full previews using the actual church:

-   Logo
-   Colors
-   Fonts
-   Church name
-   Tagline
-   Selected features

## Step 7 --- Website Builder

Show generated website.

## Step 8 --- Publish

Ask for:

-   Site slug
-   Preview
-   Publish

For MVP, only support:

``` text
<slug>.regroup.app
```

Do not implement actual custom domain provisioning yet.

------------------------------------------------------------------------

# 11. Template Architecture

Templates must NOT contain church-specific data.

A template defines composition.

Example:

``` ts
export const modernChurchTemplate: TemplateDefinition = {
  id: "modern-church",
  version: 1,
  metadata: {
    name: "Modern Church",
    description: "Modern, spacious church website",
    style: "modern",
    suitableFor: ["contemporary", "growing", "large"],
  },

  sections: [
    {
      type: "navbar",
      variant: "transparent",
    },
    {
      type: "hero",
      variant: "split",
    },
    {
      type: "welcome",
      variant: "centered",
    },
    {
      type: "sermons",
      variant: "cards",
    },
    {
      type: "events",
      variant: "grid",
    },
    {
      type: "about",
      variant: "image-right",
    },
    {
      type: "cta",
      variant: "full-width",
    },
    {
      type: "footer",
      variant: "standard",
    },
  ],
};
```

Create at least three templates:

``` text
modern-church
editorial-church
minimal-church
```

Each should have noticeably different composition.

------------------------------------------------------------------------

# 12. Section Registry

Create a central registry.

``` ts
export const sectionRegistry = {
  navbar: {
    transparent: NavbarTransparent,
    solid: NavbarSolid,
    minimal: NavbarMinimal,
  },

  hero: {
    split: HeroSplit,
    centered: HeroCentered,
    fullscreen: HeroFullscreen,
  },

  welcome: {
    centered: WelcomeCentered,
    split: WelcomeSplit,
  },

  sermons: {
    cards: SermonCards,
    featured: SermonFeatured,
    list: SermonList,
  },

  events: {
    grid: EventGrid,
    list: EventList,
    calendar: EventCalendar,
  },

  about: {
    "image-right": AboutImageRight,
    "image-left": AboutImageLeft,
  },

  ministries: {
    grid: MinistryGrid,
  },

  giving: {
    centered: GivingCentered,
  },

  youtube: {
    featured: YouTubeFeatured,
  },

  podcast: {
    featured: PodcastFeatured,
  },

  contact: {
    standard: ContactStandard,
  },

  cta: {
    "full-width": CTAFullWidth,
  },

  footer: {
    standard: FooterStandard,
  },
};
```

The renderer must never import individual sections dynamically from
arbitrary user input.

Only registered sections/variants are allowed.

------------------------------------------------------------------------

# 13. Website Renderer

Create:

``` tsx
<WebsiteRenderer siteConfig={siteConfig} />
```

The renderer should:

1.  Read template/section configuration.
2.  Check feature flags.
3.  Resolve the component from the registry.
4.  Pass site data and section configuration.
5.  Render the section.

Example:

``` tsx
function WebsiteRenderer({ siteConfig }: Props) {
  return (
    <>
      {siteConfig.sections.map((section) => {
        if (!section.enabled) return null;

        if (!isFeatureEnabled(section.type, siteConfig.features)) {
          return null;
        }

        const Component =
          sectionRegistry[section.type]?.[section.variant];

        if (!Component) {
          return null;
        }

        return (
          <Component
            key={section.id}
            site={siteConfig}
            config={section.config}
          />
        );
      })}
    </>
  );
}
```

------------------------------------------------------------------------

# 14. Feature-to-Section Mapping

Create a centralized mapping.

``` ts
const featureRequirements = {
  sermons: ["sermons"],
  sermonSearch: ["sermons", "sermonSearch"],
  events: ["events"],
  youtube: ["youtube"],
  podcast: ["podcast"],
  giving: ["giving"],
  ministries: ["ministries"],
  contact: ["contact"],
};
```

Do not scatter feature checks across the application.

------------------------------------------------------------------------

# 15. Theme Engine

Theme must be independent from templates.

Create CSS variables:

``` css
:root {
  --color-primary: #1e3a5f;
  --color-secondary: #d4af37;
  --color-background: #ffffff;
  --color-foreground: #111111;
  --color-accent: #d4af37;
}
```

Generate them from the site's brand config.

Use semantic tokens:

``` css
bg-primary
bg-secondary
text-foreground
text-muted
border-primary
```

Avoid hardcoded colors inside templates.

A template should look correct with any valid brand canvas.

------------------------------------------------------------------------

# 16. Typography

Create an approved font registry.

Example:

``` ts
const fontRegistry = {
  inter: "Inter",
  "dm-sans": "DM Sans",
  "playfair-display": "Playfair Display",
  "cormorant-garamond": "Cormorant Garamond",
  montserrat: "Montserrat",
};
```

Use Next.js font optimization where possible.

Do not allow arbitrary font URLs in the MVP.

------------------------------------------------------------------------

# 17. AI Architecture

The system must be AI-ready but should not depend on AI for basic
functionality.

Create:

``` ts
interface TemplateRecommendationEngine {
  recommend(input: RecommendationInput): Promise<TemplateRecommendation[]>;
}
```

Implement:

``` text
RuleBasedRecommendationEngine
```

first.

Later implement:

``` text
AIRecommendationEngine
```

with the same interface.

This lets the MVP work without an AI API key.

Example rules:

``` text
Large congregation
→ modern/editorial

Small congregation
→ minimal/modern

Sermons enabled
→ sermon-heavy templates

Podcast enabled
→ media-heavy templates

Traditional denomination
→ editorial/minimal

YouTube enabled
→ templates with strong media sections
```

Return:

``` ts
type TemplateRecommendation = {
  templateId: string;
  score: number;
  reasons: string[];
};
```

The UI should display short reasons such as:

``` text
Recommended because:
✓ Strong sermon presentation
✓ Works well with your brand colors
✓ Supports events
```

------------------------------------------------------------------------

# 18. AI Provider Abstraction

Create:

``` ts
interface SiteGenerationProvider {
  generateSiteConfig(
    input: SiteGenerationInput
  ): Promise<GeneratedSiteConfig>;
}
```

Implement:

``` text
DeterministicSiteGenerator
```

for MVP.

Later:

``` text
OpenAISiteGenerationProvider
```

can generate:

-   Hero copy
-   Section ordering
-   Recommended variants
-   SEO description
-   Navigation labels
-   Template recommendation

Again: AI returns JSON/configuration, never code.

------------------------------------------------------------------------

# 19. Template Preview

The template preview must use the actual site configuration.

Do NOT show generic screenshots.

For each recommendation:

``` text
Template A
   ↓
Real church logo
Real church colors
Real fonts
Real church name
Real tagline
Real feature configuration
   ↓
Preview
```

And:

``` text
Template B
   ↓
Same real data
Different layout
```

Use the same `WebsiteRenderer` for:

-   Preview
-   Draft
-   Published website

This prevents preview/production inconsistencies.

------------------------------------------------------------------------

# 20. Builder

After selecting a template, provide a simple builder.

MVP builder should support:

### Brand

-   Colors
-   Fonts
-   Logo
-   Favicon

### Site

-   Church name
-   Tagline
-   Social links

### Features

-   Sermons
-   Sermon search
-   Events
-   YouTube
-   Podcast
-   Giving
-   Ministries
-   Contact

### Sections

-   Enable/disable sections
-   Reorder sections
-   Change supported variants

Do NOT implement a free-form drag-and-drop page builder yet.

Use buttons or simple up/down controls for reordering.

------------------------------------------------------------------------

# 21. Section Configuration

Each section should support configuration.

Example:

``` ts
{
  type: "hero",
  variant: "split",
  enabled: true,
  config: {
    eyebrow: "Welcome",
    title: "A place to belong",
    description: "Join us this Sunday.",
    primaryCta: {
      label: "Plan Your Visit",
      href: "/contact"
    }
  }
}
```

This allows future AI generation and future editor functionality without
changing component architecture.

------------------------------------------------------------------------

# 22. Content Defaults

Because this is an MVP, provide safe default content when real content
does not exist.

Example:

``` text
Latest Sermons
No sermons have been added yet.
```

For events:

``` text
Upcoming Events
No upcoming events.
```

Never render broken empty cards.

------------------------------------------------------------------------

# 23. Sermon Feature

If:

``` ts
features.sermons === true
```

render a sermons section.

Create:

``` text
/sermons
/sermons/[slug]
```

Support:

-   Title
-   Speaker
-   Date
-   Series
-   Description
-   Video URL
-   Audio URL
-   Thumbnail
-   Transcript

If:

``` ts
features.sermonSearch === true
```

show search UI.

For MVP use PostgreSQL search or simple server-side filtering.

Do not introduce Elasticsearch/OpenSearch yet.

------------------------------------------------------------------------

# 24. Event Feature

If:

``` ts
features.events === true
```

render:

``` text
/events
```

and:

``` text
/events/[slug]
```

Support:

-   Title
-   Description
-   Date
-   Time
-   Location
-   Image
-   Registration URL

Only show event-related navigation when the feature is enabled.

------------------------------------------------------------------------

# 25. YouTube Feature

If YouTube is enabled:

Store:

``` ts
youtube: {
  channelUrl?: string;
}
```

Render a YouTube/media section.

For MVP, do not build a YouTube synchronization service.

Use an embed/channel link.

Create an abstraction for future synchronization:

``` ts
interface MediaProvider {
  getLatestVideos(): Promise<MediaItem[]>;
}
```

------------------------------------------------------------------------

# 26. Podcast Feature

Store:

``` ts
podcast: {
  rssUrl?: string;
}
```

Validate RSS URL format.

For MVP:

-   Show podcast link.
-   Optionally fetch RSS server-side for preview.
-   Do not implement a background sync worker yet.

Create future-ready interface:

``` ts
interface PodcastProvider {
  getEpisodes(): Promise<PodcastEpisode[]>;
}
```

------------------------------------------------------------------------

# 27. Giving Feature

If enabled:

``` ts
features.giving = true
```

Render a Giving CTA.

MVP can use:

``` ts
givingUrl?: string;
```

Do not integrate payment processing yet.

------------------------------------------------------------------------

# 28. Ministries Feature

If enabled:

``` ts
features.ministries = true
```

Render ministries section with seed/example data.

Future version can turn this into a CMS collection.

------------------------------------------------------------------------

# 29. Contact Feature

If enabled:

``` ts
features.contact = true
```

Render:

-   Email
-   Phone
-   Address
-   Social links
-   Contact CTA

Do not implement email sending in this MVP.

------------------------------------------------------------------------

# 30. Navigation

Navigation should be generated from enabled features.

Example:

``` ts
[
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Sermons", href: "/sermons" },
  { label: "Events", href: "/events" },
  { label: "Contact", href: "/contact" }
]
```

If events are disabled:

``` text
Events
```

must disappear automatically.

Never show dead navigation links.

------------------------------------------------------------------------

# 31. Publishing

Site status:

``` text
DRAFT
PUBLISHED
ARCHIVED
```

When the user clicks Publish:

1.  Validate configuration.
2.  Validate slug.
3.  Validate required brand data.
4.  Validate template.
5.  Validate feature dependencies.
6.  Save configuration.
7.  Set status to PUBLISHED.
8.  Set `publishedAt`.
9.  Show live URL.

Example:

``` text
https://grace.regroup.app
```

For local development, support:

``` text
http://localhost:3000/sites/grace
```

or equivalent host-based routing.

------------------------------------------------------------------------

# 32. Multi-Tenant Routing Design

Implement tenant resolution behind an abstraction:

``` ts
interface TenantResolver {
  resolve(hostname: string): Promise<Site | null>;
}
```

MVP:

``` text
slug.regroup.app
```

Future:

``` text
custom-domain.com
```

The website renderer must not care how the tenant was resolved.

It receives:

``` ts
site
```

and renders it.

This is critical for future Vercel custom-domain support.

------------------------------------------------------------------------

# 33. Vercel Deployment

Production target:

``` text
Vercel
   |
   +-- Next.js application
   |
   +-- *.regroup.app
```

Do not create one Vercel project per church.

The platform should use one application with tenant-aware routing.

For MVP, implement the code so hostname resolution can later support:

``` text
church.regroup.app
```

and:

``` text
www.church.com
```

without rewriting the renderer.

------------------------------------------------------------------------

# 34. Security Requirements

Even without authentication, implement basic security.

## Validate all input

Use Zod on:

-   Church information
-   URLs
-   Colors
-   Fonts
-   Feature configuration
-   Section configuration
-   Template ID
-   Slug

## Prevent arbitrary component execution

Never allow:

``` ts
componentName = userInput
```

to dynamically import arbitrary files.

Only resolve components through a fixed registry.

## Sanitize user content

Any HTML/rich text must be sanitized.

Do not use `dangerouslySetInnerHTML` unless content has been sanitized.

------------------------------------------------------------------------

# 35. Slug Rules

Slug must:

-   Be lowercase
-   Allow letters
-   Allow numbers
-   Allow hyphens
-   Be unique
-   Not conflict with reserved platform routes

Reserved:

``` text
app
api
admin
onboarding
builder
dashboard
login
settings
sites
```

Example:

``` text
Grace Community Church
→ grace-community
```

Allow manual editing.

------------------------------------------------------------------------

# 36. Validation Before Publish

Create:

``` ts
validateSiteForPublish(site)
```

Check:

-   Name exists
-   Slug exists
-   Logo exists
-   Primary color exists
-   Secondary color exists
-   Primary font exists
-   Template exists
-   Template version supported
-   Feature dependencies valid
-   Navigation valid
-   Section types valid

Return structured errors:

``` ts
{
  valid: false,
  errors: [
    {
      field: "brand.logo",
      message: "Logo is required"
    }
  ]
}
```

------------------------------------------------------------------------

# 37. Error Handling

Implement:

-   Loading UI
-   Empty states
-   Error boundaries
-   Not-found pages
-   Invalid template fallback
-   Missing section fallback
-   Invalid feature fallback
-   Database error handling

If a section is invalid, the entire website should NOT crash.

Example:

``` text
Unknown section
→ skip section
→ log error
→ continue rendering
```

------------------------------------------------------------------------

# 38. Performance

Website rendering should be optimized for public traffic.

Use:

-   Server Components
-   Static rendering where possible
-   Incremental revalidation where appropriate
-   Optimized images
-   Minimal client-side JavaScript
-   Lazy loading for heavy media sections

Do not make every website section a Client Component.

------------------------------------------------------------------------

# 39. SEO

Generate dynamic metadata:

``` ts
export async function generateMetadata() {
  return {
    title: site.seo.title,
    description: site.seo.description,
    icons: {
      icon: site.brand.favicon.url,
    },
  };
}
```

Include:

-   Title
-   Description
-   Open Graph image
-   Favicon
-   Canonical URL where available

Future:

-   Sitemap
-   Robots
-   Structured data
-   LocalBusiness/Church schema

------------------------------------------------------------------------

# 40. Seed Data

Create a Prisma seed script.

Seed:

### Templates

``` text
modern-church
editorial-church
minimal-church
```

### Demo church

``` text
Grace Community Church
```

### Demo content

At least:

-   4 sermons
-   3 events
-   3 ministries
-   social links
-   sample logo
-   sample brand colors

The application should be usable immediately after:

``` bash
npm run db:seed
```

------------------------------------------------------------------------

# 41. UX Requirements

The onboarding should feel like a modern SaaS product.

Use:

-   Progress indicator
-   Save and continue
-   Back/Next
-   Live preview
-   Loading states
-   Form validation
-   Helpful descriptions
-   Color preview
-   Font preview
-   Template comparison

Template selection should be visually strong.

Show:

``` text
Recommended
```

on the best match.

------------------------------------------------------------------------

# 42. Template Recommendation UX

Display:

``` text
We found 2 designs that fit your church.
```

Then:

``` text
┌─────────────────────┐
│                     │
│   TEMPLATE PREVIEW  │
│                     │
│  Modern Church      │
│                     │
│  ✓ Sermon focused   │
│  ✓ Event support    │
│  ✓ Your brand       │
│                     │
│   [Use this design] │
└─────────────────────┘
```

The preview must use the actual submitted:

-   Logo
-   Colors
-   Fonts
-   Church name
-   Tagline
-   Enabled features

------------------------------------------------------------------------

# 43. Important Separation of Responsibilities

Keep these concepts separate:

``` text
Template
= composition/layout

Section
= reusable website block

Variant
= visual implementation of a section

Theme
= colors/fonts/design tokens

Feature
= functionality enabled for the site

Content
= church-specific data

Site Config
= composition of all of the above
```

Do not merge these concepts.

------------------------------------------------------------------------

# 44. Example Final Site Config

``` ts
const siteConfig = {
  site: {
    id: "site_123",
    name: "Grace Community Church",
    slug: "grace",
    denomination: "Baptist",
    congregationSize: 800,
  },

  brand: {
    colors: {
      primary: "#1E3A5F",
      secondary: "#D4AF37",
      background: "#FFFFFF",
      foreground: "#111827",
      accent: "#D4AF37",
    },

    typography: {
      primaryFont: "DM Sans",
      secondaryFont: "Playfair Display",
    },

    logo: {
      url: "/uploads/grace-logo.png",
      alt: "Grace Community Church",
    },

    favicon: {
      url: "/uploads/grace-favicon.png",
    },

    tagline: "A place to belong",
  },

  features: {
    sermons: true,
    sermonSearch: true,
    events: true,
    youtube: true,
    podcast: false,
    giving: true,
    ministries: true,
    contact: true,
  },

  template: {
    id: "modern-church",
    version: 1,
  },

  sections: [
    {
      id: "hero",
      type: "hero",
      variant: "split",
      enabled: true,
      config: {},
    },
    {
      id: "sermons",
      type: "sermons",
      variant: "cards",
      enabled: true,
      config: {},
    },
    {
      id: "events",
      type: "events",
      variant: "grid",
      enabled: true,
      config: {},
    },
    {
      id: "giving",
      type: "giving",
      variant: "centered",
      enabled: true,
      config: {},
    },
  ],
};
```

------------------------------------------------------------------------

# 45. Definition of Done

The MVP is complete when a user can:

``` text
1. Open the builder
        ↓
2. Enter church information
        ↓
3. Enter social URLs
        ↓
4. Select colors
        ↓
5. Upload logo
        ↓
6. Upload favicon
        ↓
7. Select fonts
        ↓
8. Select features
        ↓
9. Enter YouTube/podcast information
        ↓
10. Receive 1–2 template recommendations
        ↓
11. Preview templates with their actual brand
        ↓
12. Select a template
        ↓
13. Generate site configuration
        ↓
14. Open website builder
        ↓
15. Modify brand/features/sections
        ↓
16. Preview website
        ↓
17. Publish
        ↓
18. Open public website using slug
```

The public website must:

-   Be responsive
-   Use the correct brand colors
-   Use the selected fonts
-   Use the uploaded logo/favicon
-   Render only enabled features
-   Render the selected template
-   Have working navigation
-   Have working sermon pages if enabled
-   Have working event pages if enabled
-   Have SEO metadata
-   Not crash when optional content is missing

------------------------------------------------------------------------

# 46. Future Architecture Compatibility

The implementation must leave clean extension points for:

``` text
Phase 2
├── Authentication
├── User accounts
├── Organizations
├── Team members
├── Roles
└── Permissions

Phase 3
├── AI site generation
├── AI copywriting
├── AI template recommendation
├── AI content import
└── AI website editing

Phase 4
├── CMS
├── Media library
├── Sermon management
├── Event management
└── Ministries

Phase 5
├── Custom domains
├── Vercel domain API
├── DNS verification
└── SSL

Phase 6
├── Stripe
├── Subscriptions
├── Usage limits
└── Billing

Phase 7
├── Analytics
├── SEO tools
├── Search
└── Integrations
```

Do not implement these now.

Build interfaces/abstractions only where they reduce future coupling.

------------------------------------------------------------------------

# 47. Development Rules for Claude Code

Follow these rules strictly.

## Rule 1

Do not create separate websites/projects for each church.

## Rule 2

Do not generate React code from AI.

## Rule 3

Do not hardcode church-specific data inside templates.

## Rule 4

Do not hardcode colors/fonts inside templates.

## Rule 5

Do not put feature logic throughout random components.

Use a centralized feature system.

## Rule 6

Do not allow arbitrary components from database/user input.

Use a fixed component registry.

## Rule 7

Do not make every section a Client Component.

Prefer Server Components.

## Rule 8

Do not implement authentication yet.

Use a temporary anonymous builder session/site ID.

## Rule 9

Do not implement billing.

## Rule 10

Do not implement custom domain provisioning yet.

But keep domain resolution abstracted.

## Rule 11

Do not over-engineer.

Build a clean MVP that can evolve.

## Rule 12

Use TypeScript strictly.

Avoid:

``` ts
any
```

unless absolutely unavoidable.

## Rule 13

Validate boundaries with Zod.

## Rule 14

Every database mutation must have server-side validation.

## Rule 15

Every public website must be renderable entirely from SiteConfig.

------------------------------------------------------------------------

# 48. Recommended Implementation Order

Claude Code should implement in this order.

### Phase 1

Project setup:

-   Next.js
-   TypeScript
-   Tailwind
-   shadcn
-   Prisma
-   PostgreSQL
-   Zod

### Phase 2

Database:

-   Site
-   Template
-   SocialLink
-   Media
-   Sermon
-   Event

### Phase 3

Design system:

-   Theme tokens
-   Font registry
-   Section components
-   Template definitions
-   Section registry

### Phase 4

Website engine:

-   SiteConfig
-   Renderer
-   Feature engine
-   Theme provider
-   Navigation generation

### Phase 5

Templates:

-   Modern
-   Editorial
-   Minimal

### Phase 6

Onboarding:

-   Church information
-   Social links
-   Brand
-   Features
-   Template recommendation
-   Template selection

### Phase 7

Builder:

-   Brand editor
-   Feature editor
-   Section enable/disable
-   Section ordering
-   Variant selection

### Phase 8

Content:

-   Sermons
-   Sermon search
-   Events
-   YouTube
-   Podcast
-   Giving
-   Ministries
-   Contact

### Phase 9

Publishing:

-   Draft
-   Preview
-   Publish
-   Slug routing

### Phase 10

Polish:

-   Loading states
-   Error states
-   SEO
-   Responsive UI
-   Accessibility
-   Performance

------------------------------------------------------------------------

# 49. Final Architecture

The final system should conceptually look like:

``` text
                         USER
                           |
                           v
                    ONBOARDING
                           |
          +----------------+----------------+
          |                |                |
          v                v                v
       CHURCH            BRAND           FEATURES
       DATA             CANVAS           CONFIG
          |                |                |
          +----------------+----------------+
                           |
                           v
                 RECOMMENDATION ENGINE
                           |
                 +---------+---------+
                 |                   |
                 v                   v
           TEMPLATE A          TEMPLATE B
                 |                   |
                 +---------+---------+
                           |
                           v
                    TEMPLATE SELECT
                           |
                           v
                     SITE CONFIG
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
          TEMPLATE       THEME        FEATURES
             |             |             |
             +-------------+-------------+
                           |
                           v
                   WEBSITE RENDERER
                           |
                           v
                    PUBLIC WEBSITE
                           |
                    Vercel deployment
                           |
             +-------------+-------------+
             |                           |
             v                           v
      grace.regroup.app          future custom domain
```

The **Website Renderer + SiteConfig + Template Registry + Feature
Engine + Theme Engine** are the core of the product. Build these
correctly first. Everything else can be layered on top later.
