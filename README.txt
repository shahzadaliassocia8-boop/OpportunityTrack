OPPORTUNITYTRACK - PRODUCTION BUILD
===================================

This build contains:
- Public OpportunityTrack website
- D1-backed Admin Panel
- Manual management for Scholarships, Admissions, Internships, Fellowships, Jobs, Schemes and Updates
- Official Source Manager
- Automatic source detection into a private Pending Review queue
- Duplicate-source protection
- Public search and fixed public templates
- About, FAQ, Contact and Privacy Policy pages
- SEO metadata, dynamic sitemap and robots.txt
- Cloudflare Pages Functions

IMPORTANT ADSENSE / CONTENT QUALITY RULE
----------------------------------------
External websites are NEVER auto-published into public content.
The monitor only detects new links from official sources and places them in Pending Review.
An Admin must verify the auto-filled facts against the official source and publish manually.
This is intentional because auto-generated or replicated content without human review creates publisher-policy risk.

HOW UPDATES WORK
----------------
Manual:
Admin Panel > Add New > fill the form > Publish.

Automatic detection:
Admin Panel > Official Sources > add an official URL > Save > Check Now.
Future checks discover unseen opportunity links and place them in Pending Review.

No extra database recreation is needed when upgrading from the earlier Admin build.
The new source-monitor tables are created automatically by the existing DB schema initializer.

AUTOMATION
----------
A lightweight visitor heartbeat checks due sources in the background when the site is being visited.
For guaranteed scheduled checks even with zero visitors, see AUTOMATION_SETUP_EASY.txt and automation-worker/.

DEPLOYMENT
----------
Use the GitHub-connected Cloudflare Pages deployment. Keep the functions/ folder at repository root.
Do not use Cloudflare Pages Direct Upload for this Functions-based build.

FINAL PUBLIC UX NOTES
- Public opportunity cards use built-in category cover images by default.
- Admins can optionally add a custom HTTPS cover image URL they own or have permission to use.
- “View details” always opens the internal OpportunityTrack detail page.
- “Apply now” appears only when a distinct direct application link is available. It never intentionally falls back to the information/source page.
- The official source is retained for editorial verification and shown only as a small verification reference on the internal detail page.

- Auto image import: when an official page exposes a usable image (for example og:image or twitter:image), the import tool stores it automatically.
- Manual image override: admins can still paste their own HTTPS image URL in the editor.
