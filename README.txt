OpportunityTrack - Professional Admin Edition
=============================================

This build contains the complete OpportunityTrack public website plus a secure
Cloudflare Pages + D1 Admin Panel.

Start here:
  ADMIN_SETUP_EASY.txt

Daily publishing after setup:
  Open site -> Admin Panel -> Login -> Add New -> Save Content

The Admin Panel can manage Scholarships, Admissions, Internships, Fellowships,
Jobs, Schemes and Updates. Public card/detail formatting is automatic and fixed.

Security model:
- Passwords are stored as PBKDF2 hashes, not plain text.
- Login sessions use Secure + HttpOnly + SameSite=Strict cookies.
- Admin APIs require authenticated sessions.
- Super Admin account management is role-protected.
- Admin/setup pages are noindex.

Files:
- migrations/0001_schema.sql : D1 database schema
- functions/                : Cloudflare Pages Functions / secure API
- admin*.html               : Admin authentication and dashboard pages
- assets/js/admin*.js       : Admin interface logic
- assets/css/admin.css      : Admin interface styling
- public HTML pages         : Existing long-form OpportunityTrack content
