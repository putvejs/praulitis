# Praulits — Folklore Ensemble Website

Website for the **Praulits Latvian Folklore Ensemble**. Full-stack application with a public-facing site and a content management system for admins and members.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 · Flask · SQLite (via `app/database.py`) |
| Frontend | React 18 · Vite build · served as static files by Flask |
| WSGI server | Waitress (`connection_limit=500`, `threads=8`) |
| Auth | Session-based (Flask sessions, role: `admin` / `member`) |
| Analytics | GoatCounter (self-hosted, shared with madona-portal) |
| Deployment | Docker Compose on Raspberry Pi · `deploy.sh` |

---

## Project Structure

```
praulitis/
├── main.py                        # Entry point — Waitress + Flask
├── app/
│   ├── __init__.py                # create_app(), blueprint registration
│   ├── auth.py                    # Login, logout, session handling
│   ├── config.py                  # .env loader (FLASK_PORT, SECRET_KEY, etc.)
│   ├── database.py                # SQLite init, DEFAULT_CONTENT, helpers
│   ├── api/
│   │   ├── admin_api.py           # Admin REST API (CRUD + bulk endpoints)
│   │   ├── member_api.py          # Member-only REST API
│   │   └── public.py              # Public REST API (events, media, gallery, members)
│   └── static/
│       └── uploads/               # Persistent: photos/, audio/, videos/ (gitignored)
├── frontend/
│   ├── src/
│   │   ├── Praulitis.jsx          # Public site (React SPA)
│   │   ├── main.jsx               # React entry point
│   │   └── admin/
│   │       ├── Admin.jsx          # Admin shell + routing
│   │       ├── Sidebar.jsx        # Admin navigation
│   │       ├── admin.css          # Admin styles (incl. bulk-bar, lightbox)
│   │       └── pages/
│   │           ├── Dashboard.jsx
│   │           ├── Content.jsx    # Editable content blocks (hero, about, etc.)
│   │           ├── Gallery.jsx    # Photo management + bulk publish
│   │           ├── Media.jsx      # Audio/video management + bulk publish
│   │           ├── Events.jsx     # Events management + bulk publish
│   │           └── Members.jsx    # Member management + bulk activate
│   ├── package.json
│   └── vite.config.js
├── frontend_dist/                 # Vite build output (served by Flask)
├── scripts/
│   ├── create_admin.py            # Create/reset admin user
│   └── import_whatsapp.py        # Import WhatsApp chat export into DB
├── data/                          # SQLite DB + uploads (persistent, gitignored)
├── deploy.sh                      # Build frontend, pack, SCP to Pi, docker compose up
├── docker-compose.yml
└── Dockerfile
```

---

## Database Tables

| Table | Purpose |
|---|---|
| `users` | Admin and member accounts (hashed passwords, role) |
| `events` | Concerts and public events |
| `gallery` | Photos with captions, album, visibility |
| `media` | Audio/video files with duration, visibility |
| `members` | Ensemble members with bio and role |
| `content_blocks` | Editable text content (hero_quote, hero_location, home_intro, about_history, …) |
| `rehearsal_schedule` | Weekly rehearsal times |
| `rehearsal_exceptions` | One-off rehearsal cancellations/changes |
| `announcements` | Internal announcements for members |

---

## Key API Endpoints

### Public
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/events` | Public events list |
| `GET` | `/api/gallery` | Public gallery photos |
| `GET` | `/api/media` | Public audio/video |
| `GET` | `/api/members` | Ensemble member list |
| `GET` | `/api/content` | All editable content blocks |

### Admin (`/api/admin/`)
| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/events` | List / create events |
| `PUT/DELETE` | `/events/<id>` | Update / delete event |
| `PUT` | `/events/bulk` | Bulk publish/unpublish `{ids, is_public}` |
| `GET/POST` | `/gallery` | List / upload photo |
| `PUT` | `/gallery/bulk` | Bulk publish/unpublish |
| `GET/POST` | `/media` | List / upload audio or video |
| `PUT` | `/media/bulk` | Bulk publish/unpublish |
| `GET/POST` | `/members` | List / create member |
| `PUT` | `/members/bulk` | Bulk activate/deactivate |
| `GET/PUT` | `/content/<key>` | Get / update content block |

---

## Auth

- `POST /login` — sets session cookie with `role` (`admin` or `member`)
- `GET /logout` — clears session cookie, redirects to `/login`
- Admin routes guarded by `@admin_required`
- Member routes guarded by `@login_required`

---

## Public Site Features

- Hero section with editable quote and location (from `content_blocks`)
- Ensemble members grid
- Events list
- Gallery with lightbox overlay on click
- Audio player with real duration (mutagen MP4 + raw mvhd atom parsing for 3gp4)
- GoatCounter analytics (audio plays and gallery opens tracked as custom events)

---

## Admin Panel Features

- Editable content blocks (hero, about, intro text)
- Gallery: upload, caption, album, bulk publish/unpublish
- Media: upload audio/video, auto-detect duration, bulk publish/unpublish
- Events: create/edit, bulk publish/unpublish
- Members: manage profiles, bulk activate/deactivate
- Rehearsal schedule management
- Announcements (member-visible)

---

## Deploy

```bash
# Full deploy (build frontend, pack, upload, rebuild container on Pi)
bash deploy.sh
```

The script:
1. Runs `npm run build` in `frontend/`
2. Tars the project (excludes `.git`, `__pycache__`, `uploads/`, `data/`)
3. SCPs the tarball to Pi at `$DEPLOY_HOST:$DEPLOY_PORT`
4. Extracts, preserves `data/` and `app/static/uploads/`, runs `docker compose up -d --build`

---

## First-Time Setup

```bash
# Create admin user (run inside container or locally with DB access)
python scripts/create_admin.py --email admin@example.com --password secret
```

---

## Analytics

GoatCounter tracks visits at `praulitis-stats.madonai.lv` (shared GoatCounter instance from madona-portal).
Tracking pixel loaded from `praulitis.madonai.lv/count.js`, events sent to `/count`.

---

*Praulits Folklore Ensemble*
