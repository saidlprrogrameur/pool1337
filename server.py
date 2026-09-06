#!/usr/bin/env python3
import hashlib, hmac, json, os, re, secrets, sqlite3, subprocess, tempfile
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT, "pooler.db")
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
EXERCISES = {}
SESSION_DAYS = 30
POOLER_BUILD = "pooler-final-v8-audited"
ADMIN_USERNAME = re.sub(r"[^a-zA-Z0-9_.-]", "", os.environ.get("POOLER_ADMIN_USERNAME", "").strip())[:24]
ADMIN_PASSWORD = os.environ.get("POOLER_ADMIN_PASSWORD", "")

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    psycopg = None
    dict_row = None


def load_exercises():
    data = json.load(open(os.path.join(ROOT, "pooler-data.json"), encoding="utf-8"))
    for item in data.get("exercises", []) + data.get("exams", []):
        EXERCISES[item["id"]] = item


def exercise_xp(exercise_id):
    item = EXERCISES.get(exercise_id) or {}
    difficulty = str(item.get("difficulty", "easy")).lower()
    return {"easy": 100, "medium": 150, "hard": 250}.get(difficulty, 100)


def calculate_progress(solved_ids):
    valid = []
    seen = set()
    for exercise_id in solved_ids if isinstance(solved_ids, list) else []:
        exercise_id = str(exercise_id)
        if exercise_id in EXERCISES and exercise_id not in seen:
            valid.append(exercise_id)
            seen.add(exercise_id)
    xp = sum(exercise_xp(exercise_id) for exercise_id in valid)
    level = 1 + (xp // 500)
    return valid, xp, level


def migrate_real_accounts():
    # Remove the accounts created by previous test/local builds exactly once.
    c = db()
    c.execute("CREATE TABLE IF NOT EXISTS pooler_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    if using_postgres():
        row = c.execute("SELECT value FROM pooler_meta WHERE key=%s", ("real_accounts_v3_reset",)).fetchone()
    else:
        row = c.execute("SELECT value FROM pooler_meta WHERE key=?", ("real_accounts_v3_reset",)).fetchone()
    if not row:
        c.execute("DELETE FROM sessions")
        c.execute("DELETE FROM profiles")
        if using_postgres():
            c.execute("INSERT INTO pooler_meta(key,value) VALUES(%s,%s)", ("real_accounts_v3_reset", "done"))
        else:
            c.execute("INSERT INTO pooler_meta(key,value) VALUES(?,?)", ("real_accounts_v3_reset", "done"))
            c.commit()
    c.close()


def using_postgres():
    return bool(DATABASE_URL)


def db():
    if using_postgres():
        if psycopg is None:
            raise RuntimeError("DATABASE_URL is set but psycopg is not installed")
        conn = psycopg.connect(DATABASE_URL, autocommit=True)
        conn.row_factory = dict_row
        return conn
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    c = db()
    if using_postgres():
        c.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                name TEXT NOT NULL,
                bio TEXT DEFAULT '',
                xp INTEGER DEFAULT 0,
                solved INTEGER DEFAULT 0,
                streak INTEGER DEFAULT 0,
                best_streak INTEGER DEFAULT 0,
                runs INTEGER DEFAULT 0,
                opened_drills INTEGER DEFAULT 0,
                last_active TEXT DEFAULT '',
                state_json TEXT DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                expires_at TIMESTAMPTZ NOT NULL
            )
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_sessions_profile ON sessions(profile_id)")
        # Existing Neon databases created by earlier builds may be missing newer columns.
        # CREATE TABLE IF NOT EXISTS does not alter an existing table, so migrate them safely.
        for column, definition in (
            ("role", "TEXT DEFAULT 'user'"),
            ("bio", "TEXT DEFAULT ''"),
            ("xp", "INTEGER DEFAULT 0"),
            ("xp_bonus", "INTEGER DEFAULT 0"),
            ("solved", "INTEGER DEFAULT 0"),
            ("solved_bonus", "INTEGER DEFAULT 0"),
            ("streak", "INTEGER DEFAULT 0"),
            ("best_streak", "INTEGER DEFAULT 0"),
            ("runs", "INTEGER DEFAULT 0"),
            ("opened_drills", "INTEGER DEFAULT 0"),
            ("last_active", "TEXT DEFAULT ''"),
            ("state_json", "TEXT DEFAULT '{}'"),
        ):
            c.execute(f"ALTER TABLE profiles ADD COLUMN IF NOT EXISTS {column} {definition}")
        c.execute("CREATE INDEX IF NOT EXISTS idx_leaderboard ON profiles(solved DESC, streak DESC, name ASC)")
    else:
        c.execute("""CREATE TABLE IF NOT EXISTS profiles(
            id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user',
            name TEXT NOT NULL, bio TEXT DEFAULT '', xp INTEGER DEFAULT 0, xp_bonus INTEGER DEFAULT 0, solved INTEGER DEFAULT 0, solved_bonus INTEGER DEFAULT 0,
            streak INTEGER DEFAULT 0, best_streak INTEGER DEFAULT 0, runs INTEGER DEFAULT 0,
            opened_drills INTEGER DEFAULT 0, last_active TEXT DEFAULT '', state_json TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS sessions(
            token_hash TEXT PRIMARY KEY, profile_id TEXT NOT NULL,
            expires_at TEXT NOT NULL
        )""")
        # Old development databases may have the old profiles schema. Do not expose them as real accounts.
        cols = {r[1] for r in c.execute("PRAGMA table_info(profiles)").fetchall()}
        required = {"username", "password_hash", "state_json"}
        if "role" not in cols:
            c.execute("ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user'")
            c.commit()
            cols.add("role")
        if not required.issubset(cols):
            c.execute("DROP TABLE IF EXISTS sessions")
            c.execute("DROP TABLE IF EXISTS profiles")
            c.execute("""CREATE TABLE profiles(
                id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user',
                name TEXT NOT NULL, bio TEXT DEFAULT '', xp INTEGER DEFAULT 0, xp_bonus INTEGER DEFAULT 0, solved INTEGER DEFAULT 0, solved_bonus INTEGER DEFAULT 0,
                streak INTEGER DEFAULT 0, best_streak INTEGER DEFAULT 0, runs INTEGER DEFAULT 0,
                opened_drills INTEGER DEFAULT 0, last_active TEXT DEFAULT '', state_json TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )""")
            c.execute("CREATE TABLE sessions(token_hash TEXT PRIMARY KEY, profile_id TEXT NOT NULL, expires_at TEXT NOT NULL)")
        c.commit()
    c.close()


def row_dict(row):
    if row is None:
        return None
    return dict(row) if not using_postgres() else dict(row)


def normalize_username(value):
    return re.sub(r"[^a-zA-Z0-9_.-]", "", str(value or "").strip())[:24]


def password_hash(password, salt=None):
    if salt is None:
        salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310_000)
    return "pbkdf2_sha256$310000$%s$%s" % (salt.hex(), digest.hex())


def verify_password(password, stored):
    try:
        alg, rounds, salt_hex, digest_hex = stored.split("$", 3)
        if alg != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(rounds))
        return hmac.compare_digest(digest.hex(), digest_hex)
    except Exception:
        return False


def request_json(handler):
    n = int(handler.headers.get("Content-Length", "0"))
    if n > 2_000_000:
        raise ValueError("Request too large")
    return json.loads(handler.rfile.read(n) or b"{}")


def session_cookie(handler):
    raw = handler.headers.get("Cookie", "")
    for part in raw.split(";"):
        k, _, v = part.strip().partition("=")
        if k == "pooler_session":
            return v
    return ""


def current_user(handler):
    token = session_cookie(handler)
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    c = db()
    if using_postgres():
        row = c.execute("""SELECT p.* FROM sessions s JOIN profiles p ON p.id=s.profile_id
                           WHERE s.token_hash=%s AND s.expires_at > NOW()""", (token_hash,)).fetchone()
    else:
        row = c.execute("""SELECT p.* FROM sessions s JOIN profiles p ON p.id=s.profile_id
                           WHERE s.token_hash=? AND datetime(s.expires_at) > datetime('now')""", (token_hash,)).fetchone()
    c.close()
    return row_dict(row)


def issue_session(handler, profile_id):
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    c = db()
    if using_postgres():
        c.execute("INSERT INTO sessions(token_hash,profile_id,expires_at) VALUES(%s,%s,%s)", (token_hash, profile_id, expires))
        c.execute("DELETE FROM sessions WHERE expires_at <= NOW()")
    else:
        c.execute("INSERT INTO sessions(token_hash,profile_id,expires_at) VALUES(?,?,?)", (token_hash, profile_id, expires.isoformat()))
        c.execute("DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')")
        c.commit()
    c.close()
    secure = "; Secure" if handler.headers.get("X-Forwarded-Proto", "").lower() == "https" else ""
    handler.send_header("Set-Cookie", f"pooler_session={token}; Path=/; Max-Age={SESSION_DAYS*86400}; HttpOnly; SameSite=Lax{secure}")


def clear_session(handler):
    token = session_cookie(handler)
    if token:
        c = db()
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        if using_postgres():
            c.execute("DELETE FROM sessions WHERE token_hash=%s", (token_hash,))
        else:
            c.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash,)); c.commit()
        c.close()
    secure = "; Secure" if handler.headers.get("X-Forwarded-Proto", "").lower() == "https" else ""
    handler.send_header("Set-Cookie", f"pooler_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax{secure}")


def public_user(row):
    if not row:
        return None
    state = {}
    try:
        state = json.loads(row.get("state_json") or "{}")
    except Exception:
        pass
    # Use .get() for every optional DB column so an older Postgres schema
    # cannot crash the leaderboard endpoint.
    return {
        "id": row.get("id", ""),
        "username": row.get("username", ""),
        "role": row.get("role", "user") or "user",
        "name": row.get("name", ""),
        "bio": row.get("bio") or "",
        "avatar": state.get("avatar", "") if isinstance(state, dict) else "",
        "xp": max(0, int(row.get("xp") or 0) + int(row.get("xp_bonus") or 0)),
        "level": 1 + (max(0, int(row.get("xp") or 0) + int(row.get("xp_bonus") or 0)) // 500),
        "solved": max(0, int(row.get("solved") or 0) + int(row.get("solved_bonus") or 0)),
        "streak": int(row.get("streak") or 0),
        "best_streak": int(row.get("best_streak") or 0),
        "runs": int(row.get("runs") or 0),
        "opened_drills": int(row.get("opened_drills") or 0),
        "last_active": row.get("last_active") or "",
        "state": state
    }



def is_admin(user):
    return bool(user and str(user.get("role", "user")) == "admin")


def require_admin(handler):
    user = current_user(handler)
    if not is_admin(user):
        handler.send_json({"ok": False, "error": "Admin access required."}, 403)
        return None
    return user


def admin_users():
    c = db()
    if using_postgres():
        rows = c.execute("SELECT id,username,role,name,bio,xp,xp_bonus,solved,solved_bonus,streak,best_streak,runs,opened_drills,last_active,state_json,created_at,updated_at FROM profiles ORDER BY role DESC, (xp + xp_bonus) DESC, (solved + solved_bonus) DESC, username ASC").fetchall()
    else:
        rows = c.execute("SELECT id,username,role,name,bio,xp,xp_bonus,solved,solved_bonus,streak,best_streak,runs,opened_drills,last_active,state_json,created_at,updated_at FROM profiles ORDER BY role DESC, (xp + xp_bonus) DESC, (solved + solved_bonus) DESC, username ASC").fetchall()
    c.close()
    return [public_user(row_dict(r)) | {"created_at": str(row_dict(r).get("created_at") or ""), "updated_at": str(row_dict(r).get("updated_at") or "")} for r in rows]

class Handler(SimpleHTTPRequestHandler):
    def send_json(self, data, status=200):
        raw = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path == "/api/health":
            return self.send_json({"ok": True, "database": "postgres" if using_postgres() else "sqlite-local", "build": POOLER_BUILD})
        if self.path == "/api/me":
            return self.send_json({"authenticated": bool(current_user(self)), "user": public_user(current_user(self))})
        if self.path == "/api/leaderboard":
            c = db()
            if using_postgres():
                rows = c.execute("SELECT id,username,name,bio,xp,xp_bonus,solved,solved_bonus,streak,best_streak,runs,opened_drills,last_active,state_json FROM profiles ORDER BY (xp + xp_bonus) DESC, (solved + solved_bonus) DESC, streak DESC, name ASC LIMIT 50").fetchall()
            else:
                rows = c.execute("SELECT id,username,name,bio,xp,xp_bonus,solved,solved_bonus,streak,best_streak,runs,opened_drills,last_active,state_json FROM profiles ORDER BY (xp + xp_bonus) DESC, (solved + solved_bonus) DESC, streak DESC, name ASC LIMIT 50").fetchall()
            c.close()
            return self.send_json({"users": [public_user(row_dict(r)) for r in rows], "persistent": using_postgres()})
        if self.path == "/api/admin/users":
            if not require_admin(self): return
            return self.send_json({"ok": True, "users": admin_users()})
        return super().do_GET()

    def do_POST(self):
        try:
            if self.path == "/api/auth/register":
                b = request_json(self)
                username = normalize_username(b.get("username"))
                password = str(b.get("password", ""))
                if len(username) < 3:
                    return self.send_json({"ok": False, "error": "Username must be at least 3 characters."}, 400)
                if len(password) < 8:
                    return self.send_json({"ok": False, "error": "Password must be at least 8 characters."}, 400)
                name = str(b.get("name", username)).strip()[:24] or username
                bio = str(b.get("bio", "Build skill, not noise.")).strip()[:60]
                submitted_state = b.get("state") if isinstance(b.get("state"), dict) else {}
                # New accounts start clean. Browser progress is never imported into the leaderboard.
                state = {"name": name, "bio": bio}
                avatar = submitted_state.get("avatar", "")
                if isinstance(avatar, str) and avatar and len(avatar) <= 300000 and re.match(r"^data:image/(jpeg|png|webp);base64,", avatar, re.I):
                    state["avatar"] = avatar
                profile_id = secrets.token_hex(16)
                role = "admin" if ADMIN_USERNAME and ADMIN_PASSWORD and username.lower() == ADMIN_USERNAME.lower() and hmac.compare_digest(password, ADMIN_PASSWORD) else "user"
                state_json = json.dumps(state, ensure_ascii=False)
                c = db()
                try:
                    if using_postgres():
                        c.execute("INSERT INTO profiles(id,username,password_hash,role,name,bio,xp,xp_bonus,solved,solved_bonus,streak,best_streak,runs,opened_drills,last_active,state_json) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                                  (profile_id, username, password_hash(password), role, name, bio, 0, 0, 0, 0, int(state.get("streak",0) or 0), int(state.get("bestStreak",0) or 0), int(state.get("runs",0) or 0), int(state.get("openedDrills",0) or 0), str(state.get("lastActive", "")), state_json))
                    else:
                        c.execute("INSERT INTO profiles(id,username,password_hash,role,name,bio,xp,xp_bonus,solved,solved_bonus,streak,best_streak,runs,opened_drills,last_active,state_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                                  (profile_id, username, password_hash(password), role, name, bio, 0, 0, 0, 0, int(state.get("streak",0) or 0), int(state.get("bestStreak",0) or 0), int(state.get("runs",0) or 0), int(state.get("openedDrills",0) or 0), str(state.get("lastActive", "")), state_json))
                        c.commit()
                except Exception as e:
                    if not using_postgres(): c.rollback()
                    msg = "Username already exists." if "unique" in str(e).lower() else str(e)
                    c.close(); return self.send_json({"ok": False, "error": msg}, 409 if "exists" in msg.lower() else 400)
                c.close()
                row = current_user_after_id(profile_id)
                self.send_response(200); self.send_header("Content-Type", "application/json; charset=utf-8"); issue_session(self, profile_id); self.send_header("Cache-Control", "no-store")
                payload = json.dumps({"ok": True, "user": public_user(row)}, ensure_ascii=False).encode(); self.send_header("Content-Length", str(len(payload))); self.end_headers(); self.wfile.write(payload); return

            if self.path == "/api/auth/login":
                b = request_json(self); username = normalize_username(b.get("username")); password = str(b.get("password", "")); c = db()
                if using_postgres(): row = c.execute("SELECT * FROM profiles WHERE lower(username)=lower(%s)", (username,)).fetchone()
                else: row = c.execute("SELECT * FROM profiles WHERE lower(username)=lower(?)", (username,)).fetchone()
                c.close(); row = row_dict(row)
                if not row or not verify_password(password, row["password_hash"]): return self.send_json({"ok": False, "error": "Invalid username or password."}, 401)
                self.send_response(200); self.send_header("Content-Type", "application/json; charset=utf-8"); issue_session(self, row["id"]); self.send_header("Cache-Control", "no-store")
                payload = json.dumps({"ok": True, "user": public_user(row)}, ensure_ascii=False).encode(); self.send_header("Content-Length", str(len(payload))); self.end_headers(); self.wfile.write(payload); return

            if self.path == "/api/auth/logout":
                self.send_response(200); self.send_header("Content-Type", "application/json; charset=utf-8"); clear_session(self); payload=b'{"ok":true}'; self.send_header("Content-Length",str(len(payload))); self.end_headers(); self.wfile.write(payload); return

            if self.path == "/api/progress":
                user = current_user(self)
                if not user: return self.send_json({"ok": False, "error": "Login required."}, 401)
                b = request_json(self); state = b.get("state") if isinstance(b.get("state"), dict) else {}
                avatar = state.get("avatar", "")
                if avatar and (not isinstance(avatar, str) or len(avatar) > 300000 or not re.match(r"^data:image/(jpeg|png|webp);base64,", avatar, re.I)):
                    return self.send_json({"ok": False, "error": "Invalid or oversized profile picture."}, 413)
                name = str(state.get("name", user["name"])).strip()[:24] or user["name"]
                bio = str(state.get("bio", user["bio"])).strip()[:60]
                solved_list, xp, level = calculate_progress(state.get("solved", []))
                state["solved"] = solved_list
                state["xp"] = xp
                state["level"] = level
                solved = len(solved_list)
                c=db()
                if using_postgres():
                    current = c.execute("SELECT xp_bonus,solved_bonus FROM profiles WHERE id=%s", (user["id"],)).fetchone()
                    xb, sb = int(current.get("xp_bonus") or 0), int(current.get("solved_bonus") or 0)
                    c.execute("UPDATE profiles SET name=%s,bio=%s,xp=%s,solved=%s,streak=%s,best_streak=%s,runs=%s,opened_drills=%s,last_active=%s,state_json=%s,updated_at=NOW() WHERE id=%s", (name,bio,xp,solved,int(state.get("streak",0) or 0),int(state.get("bestStreak",0) or 0),int(state.get("runs",0) or 0),int(state.get("openedDrills",0) or 0),str(state.get("lastActive", "")),json.dumps(state,ensure_ascii=False),user["id"]))
                else:
                    current = c.execute("SELECT xp_bonus,solved_bonus FROM profiles WHERE id=?", (user["id"],)).fetchone()
                    c.execute("UPDATE profiles SET name=?,bio=?,xp=?,solved=?,streak=?,best_streak=?,runs=?,opened_drills=?,last_active=?,state_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (name,bio,xp,solved,int(state.get("streak",0) or 0),int(state.get("bestStreak",0) or 0),int(state.get("runs",0) or 0),int(state.get("openedDrills",0) or 0),str(state.get("lastActive", "")),json.dumps(state,ensure_ascii=False),user["id"])); c.commit()
                c.close(); return self.send_json({"ok": True})

            if self.path == "/api/admin/users/delete":
                admin = require_admin(self)
                if not admin: return
                b = request_json(self); target = str(b.get("id", ""))
                if not target or target == admin.get("id"):
                    return self.send_json({"ok": False, "error": "You cannot delete the current admin account."}, 400)
                c=db()
                if using_postgres(): c.execute("DELETE FROM profiles WHERE id=%s", (target,))
                else: c.execute("DELETE FROM profiles WHERE id=?", (target,)); c.commit()
                c.close(); return self.send_json({"ok": True})

            if self.path == "/api/admin/users/update":
                admin = require_admin(self)
                if not admin: return
                b=request_json(self); target=str(b.get("id", "")); c=db()
                if using_postgres(): row=c.execute("SELECT * FROM profiles WHERE id=%s",(target,)).fetchone()
                else: row=c.execute("SELECT * FROM profiles WHERE id=?",(target,)).fetchone()
                row=row_dict(row)
                if not row: c.close(); return self.send_json({"ok":False,"error":"User not found."},404)
                username=normalize_username(b.get("username",row.get("username"))) or row.get("username")
                name=str(b.get("name",row.get("name"))).strip()[:24] or row.get("name")
                bio=str(b.get("bio",row.get("bio"))).strip()[:120]
                requested_xp=max(0,min(100000000,int(b.get("xp",row.get("xp",0)) or 0)))
                requested_solved=max(0,min(100000,int(b.get("solved",row.get("solved",0)) or 0)))
                saved_state={}
                try: saved_state=json.loads(row.get("state_json") or "{}")
                except Exception: saved_state={}
                base_solved, base_xp, _ = calculate_progress(saved_state.get("solved", []))
                xp=base_xp
                solved=len(base_solved)
                xp_bonus=requested_xp-base_xp
                solved_bonus=requested_solved-len(base_solved)
                streak=max(0,min(100000,int(b.get("streak",row.get("streak",0)) or 0)))
                best=max(0,min(100000,int(b.get("best_streak",row.get("best_streak",0)) or 0)))
                runs=max(0,min(10000000,int(b.get("runs",row.get("runs",0)) or 0)))
                opened=max(0,min(10000000,int(b.get("opened_drills",row.get("opened_drills",0)) or 0)))
                role="admin" if str(b.get("role",row.get("role","user")))=="admin" else "user"
                if target == admin.get("id"): role="admin"
                try:
                    if using_postgres(): c.execute("UPDATE profiles SET username=%s,name=%s,bio=%s,xp=%s,xp_bonus=%s,solved=%s,solved_bonus=%s,streak=%s,best_streak=%s,runs=%s,opened_drills=%s,role=%s,updated_at=NOW() WHERE id=%s",(username,name,bio,xp,xp_bonus,solved,solved_bonus,streak,best,runs,opened,role,target))
                    else: c.execute("UPDATE profiles SET username=?,name=?,bio=?,xp=?,xp_bonus=?,solved=?,solved_bonus=?,streak=?,best_streak=?,runs=?,opened_drills=?,role=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",(username,name,bio,xp,xp_bonus,solved,solved_bonus,streak,best,runs,opened,role,target)); c.commit()
                except Exception as e:
                    if not using_postgres(): c.rollback()
                    c.close(); return self.send_json({"ok":False,"error":"Username already exists." if "unique" in str(e).lower() else str(e)},409)
                if using_postgres(): row=c.execute("SELECT * FROM profiles WHERE id=%s",(target,)).fetchone()
                else: row=c.execute("SELECT * FROM profiles WHERE id=?",(target,)).fetchone()
                c.close(); return self.send_json({"ok":True,"user":public_user(row_dict(row))})

            if self.path == "/api/admin/users/reset":
                admin=require_admin(self)
                if not admin: return
                b=request_json(self); target=str(b.get("id",""))
                if target == admin.get("id"): return self.send_json({"ok":False,"error":"You cannot reset the current admin account."},400)
                state={"name":"Learner","bio":"Build skill, not noise."}
                c=db()
                if using_postgres(): c.execute("UPDATE profiles SET xp=0,xp_bonus=0,solved=0,solved_bonus=0,streak=0,best_streak=0,runs=0,last_active='',state_json=%s,updated_at=NOW() WHERE id=%s",(json.dumps(state),target))
                else: c.execute("UPDATE profiles SET xp=0,xp_bonus=0,solved=0,solved_bonus=0,streak=0,best_streak=0,runs=0,last_active='',state_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",(json.dumps(state),target)); c.commit()
                c.close(); return self.send_json({"ok":True})

            if self.path == "/api/run":
                b=request_json(self); code=str(b.get("code", "")); item=EXERCISES.get(b.get("exercise")); tests=item.get("tests",[]) if item else []
                with tempfile.TemporaryDirectory(prefix="pooler-") as td:
                    src=os.path.join(td,"main.c"); exe=os.path.join(td,"main"); open(src,"w",encoding="utf-8").write(code)
                    is_program=bool(re.search(r"\bmain\s*\(",code))
                    if is_program:
                        cp=subprocess.run(["cc","-std=c99","-Wall","-Wextra","-O0",src,"-o",exe],capture_output=True,text=True,timeout=8)
                        if cp.returncode: return self.send_json({"compile":"$ compile failed","error":cp.stderr,"tests":[],"all_pass":False})
                        try:
                            rp=subprocess.run([exe],capture_output=True,text=True,timeout=2); ok=rp.returncode==0; results=[]
                            for t in tests:
                                test_ok=rp.returncode==0
                                if t.get("expected","")!="": test_ok=test_ok and rp.stdout==t["expected"]
                                for needle in t.get("expected_contains",[]): test_ok=test_ok and needle in rp.stdout
                                ok=ok and test_ok; results.append({"name":t.get("name","runtime"),"pass":test_ok,"detail":f"exit={rp.returncode} · output={rp.stdout!r}"})
                            if not results: results=[{"name":"runtime","pass":ok,"detail":f"exit={rp.returncode} · output={rp.stdout!r}"}]
                            return self.send_json({"compile":"$ compile: OK","output":rp.stdout,"error":rp.stderr,"tests":results,"all_pass":ok})
                        except subprocess.TimeoutExpired: return self.send_json({"compile":"$ compile: OK","error":"Program timed out after 2 seconds.","tests":[{"name":"runtime","pass":False,"detail":"Timed out after 2 seconds."}],"all_pass":False})
                    if not tests: return self.send_json({"compile":"$ no validation available","output":"","error":"This drill has no validation test.","tests":[],"all_pass":False})
                    results=[]
                    for idx,t in enumerate(tests,1):
                        ts=os.path.join(td,f"test_{idx}.c"); te=os.path.join(td,f"test_{idx}"); harness=t.get("harness",""); open(ts,"w",encoding="utf-8").write("#include <string.h>\n#include <stdlib.h>\n"+code+"\n\n"+harness+"\n")
                        cp=subprocess.run(["cc","-std=c99","-Wall","-Wextra","-O0",ts,"-o",te],capture_output=True,text=True,timeout=8)
                        if cp.returncode: results.append({"name":t["name"],"pass":False,"detail":"Harness compile failed: "+cp.stderr.strip()}); continue
                        try:
                            rp=subprocess.run([te],capture_output=True,text=True,timeout=2); expected=t.get("expected",""); ok=rp.returncode==0 and rp.stdout==expected; results.append({"name":t["name"],"pass":ok,"detail":f"expected={expected!r} · actual={rp.stdout!r}"})
                        except subprocess.TimeoutExpired: results.append({"name":t["name"],"pass":False,"detail":"Timed out after 2 seconds."})
                    return self.send_json({"compile":"$ test harness compile: OK","output":"","error":"","tests":results,"all_pass":bool(results) and all(x["pass"] for x in results)})
            return self.send_error(404)
        except Exception as e:
            return self.send_json({"ok": False, "error": str(e)}, 500)



def ensure_admin_from_env():
    if not ADMIN_USERNAME or len(ADMIN_USERNAME) < 3 or not ADMIN_PASSWORD or len(ADMIN_PASSWORD) < 8:
        return
    c=db()
    if using_postgres():
        row=c.execute("SELECT * FROM profiles WHERE lower(username)=lower(%s)",(ADMIN_USERNAME,)).fetchone()
    else:
        row=c.execute("SELECT * FROM profiles WHERE lower(username)=lower(?)",(ADMIN_USERNAME,)).fetchone()
    if row:
        if using_postgres(): c.execute("UPDATE profiles SET role='admin',password_hash=%s,updated_at=NOW() WHERE id=%s",(password_hash(ADMIN_PASSWORD),row["id"]))
        else: c.execute("UPDATE profiles SET role='admin',password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",(password_hash(ADMIN_PASSWORD),row["id"])); c.commit()
    else:
        profile_id=secrets.token_hex(16); name=ADMIN_USERNAME; state=json.dumps({"name":name,"bio":"POOLER administrator"})
        if using_postgres(): c.execute("INSERT INTO profiles(id,username,password_hash,role,name,bio,state_json) VALUES(%s,%s,%s,'admin',%s,%s,%s)",(profile_id,ADMIN_USERNAME,password_hash(ADMIN_PASSWORD),name,"POOLER administrator",state))
        else: c.execute("INSERT INTO profiles(id,username,password_hash,role,name,bio,state_json) VALUES(?,?,?,?,?,?,?)",(profile_id,ADMIN_USERNAME,password_hash(ADMIN_PASSWORD),'admin',name,"POOLER administrator",state)); c.commit()
    c.close()

def current_user_after_id(profile_id):
    c=db()
    if using_postgres(): row=c.execute("SELECT * FROM profiles WHERE id=%s",(profile_id,)).fetchone()
    else: row=c.execute("SELECT * FROM profiles WHERE id=?",(profile_id,)).fetchone()
    c.close(); return row_dict(row)

load_exercises()
init_db()
migrate_real_accounts()
ensure_admin_from_env()
os.chdir(ROOT)
port=int(os.environ.get("PORT","8000"))
print(f"POOLER running on port {port} · database={'postgres' if using_postgres() else 'sqlite-local'}")
ThreadingHTTPServer(("0.0.0.0",port),Handler).serve_forever()
