POOLER — persistent accounts + leaderboard

Local run:
  ./run.sh

Production on Render:
  Build: pip install -r requirements.txt && python3 -m py_compile server.py
  Start: python3 server.py

Persistent database:
  Set DATABASE_URL to a PostgreSQL connection string (Neon or Supabase).
  The server creates the profiles and sessions tables automatically on first start.
  Without DATABASE_URL, SQLite is used only for local development; Render's filesystem is not a permanent database.

Accounts:
  Users can create an account, log in, and keep progress, solved exercises, streaks and leaderboard data across restarts/redeploys.
  Passwords are stored as PBKDF2-SHA256 hashes; raw passwords are never stored.

The code runner remains the existing server-side compiler/runtime and is not a production sandbox.

REAL LEADERBOARD V3
- Previous test/local accounts are cleared once on first V3 startup.
- Only accounts created through the real register/login flow appear.
- XP is authoritative on the server and is calculated from valid solved exercises.
- XP values: easy 100, medium 150, hard 250.
- Level = 1 + floor(XP / 500).
- Leaderboard ranks by XP, then solved count, streak, and name.

ADMIN CONSOLE
- Set Render environment variables POOLER_ADMIN_USERNAME and POOLER_ADMIN_PASSWORD (password must be at least 8 characters).
- On startup the configured admin account is created/promoted automatically and its password is reset to the configured value.
- The admin sees a private Admin Console and can edit usernames, names, bios, XP, solved/streak stats, runs, drill counts and roles; reset user progress; or permanently delete accounts.
- Admin access is enforced server-side on /api/admin/*; users cannot grant themselves admin through registration.
