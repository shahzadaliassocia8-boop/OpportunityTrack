const SCHEMA = [
`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','super_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  recovery_hash TEXT,
  recovery_salt TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
)`,
`CREATE TABLE IF NOT EXISTS password_reset_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved')),
  resolved_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
)`,
`CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('Scholarship','Admission','Internship','Fellowship','Job','Scheme','Update')),
  organization TEXT,
  country TEXT,
  city TEXT,
  funding TEXT,
  degree_level TEXT,
  deadline TEXT,
  published_date TEXT,
  featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
  short_description TEXT NOT NULL,
  eligibility TEXT,
  full_details TEXT,
  application_link TEXT,
  official_source TEXT,
  tags TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
)`,
`CREATE INDEX IF NOT EXISTS idx_opportunities_status_category ON opportunities(status, category)`,
`CREATE INDEX IF NOT EXISTS idx_opportunities_published ON opportunities(published_date DESC)`,
`CREATE INDEX IF NOT EXISTS idx_reset_status ON password_reset_requests(status, requested_at DESC)`,
`CREATE TABLE IF NOT EXISTS official_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'auto' CHECK(source_type IN ('auto','rss','html')),
  default_category TEXT NOT NULL DEFAULT 'Scholarship' CHECK(default_category IN ('Scholarship','Admission','Internship','Fellowship','Job','Scheme','Update')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  check_interval_hours INTEGER NOT NULL DEFAULT 12 CHECK(check_interval_hours BETWEEN 1 AND 168),
  last_checked_at TEXT,
  last_success_at TEXT,
  last_http_status INTEGER,
  last_error TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
)`,
`CREATE TABLE IF NOT EXISTS source_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  external_key TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  summary TEXT,
  detected_category TEXT,
  source_published_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','imported','ignored')),
  opportunity_id INTEGER,
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  FOREIGN KEY(source_id) REFERENCES official_sources(id) ON DELETE CASCADE,
  FOREIGN KEY(opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL,
  UNIQUE(source_id, external_key)
)`,
`CREATE TABLE IF NOT EXISTS automation_state (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE INDEX IF NOT EXISTS idx_sources_active_due ON official_sources(active,last_checked_at)`,
`CREATE INDEX IF NOT EXISTS idx_source_items_status ON source_items(status,detected_at DESC)`
];

export async function ensureSchema(env){
  if(!env?.DB) return false;
  await env.DB.batch(SCHEMA.map(sql=>env.DB.prepare(sql)));
  return true;
}
