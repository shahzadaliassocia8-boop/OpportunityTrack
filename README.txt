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
An Admin must verify the official source, add original useful details, and publish manually.
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
