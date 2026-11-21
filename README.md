# Shakham Vault

An executive-grade, zero-knowledge, Git-versioned environment variable and secret management vault built for engineering teams at **Shakham Inc.**

---

## ⚡ Tech Stack & Architecture

- **Backend:** Python FastAPI, SQLAlchemy, Pydantic v2, AES-256-GCM encryption, JWT Authentication, bcrypt password hashing.
- **Database:** PostgreSQL (Neon Cloud / Serverless Postgres)
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons.
- **Production Deployments:**
  - **Frontend:** Vercel (Single Page App with `vercel.json` rewrites)
  - **Backend:** Render (FastAPI Web Service with Uvicorn / Gunicorn)

---

## 🛡️ Role-Based Access Control (RBAC)

| Role | Creation Privileges | Visibility Scope | Secret Editing & Deleting |
| :--- | :--- | :--- | :--- |
| **Admin** | Can create **Leads** and **Employees** (assigning at least one Lead is mandatory). | Universal company-wide visibility. | Can view, edit, commit, and delete any `.env` file or folder. Reviews Lead employee access requests with mandatory rejection reasoning. |
| **Lead** | Can create **Employees** (automatically assigned to this Lead). | All assigned Employees + folders shared with them. Can request access to other employees via Admin approval. | Can edit, commit, and delete `.env` files of assigned employees. |
| **Employee** | Cannot create users. | **Isolated** (only sees own folders/.envs and folders shared with them). Zero peer visibility. | Can create, edit, commit, and delete own folders and `.env` files. |

---

## 🚀 Key Features

1. **Notepad-Style Editor & Git Commits:**
   - Freeform multi-line text editor for `.env` variables (`KEY=VALUE`).
   - Every save requires a commit message and produces an immutable snapshot with author attribution and timestamp.
   - Chronological commit history timeline with one-click rollbacks.
2. **Visual Line-by-Line Diff Viewer:**
   - Color-coded diffs: additions, deletions, line numbers, and commit comparison selector.
3. **Secret Masking & Peek Mode (Anti-Shoulder Surfing):**
   - Toggle button blurs values (`•••••••`) during screen shares.
   - 1-Click Copy to Clipboard with audit logging.
4. **Folder Hierarchy & Granular Sharing:**
   - Nested folder trees (folders inside folders).
   - Leads/Admins can share specific folders with individual employees/leads with `READ` (view only) or `WRITE` (edit & commit) permissions.
5. **Lead Access Request Flow with Mandatory Rejection Reasoning:**
   - Leads can submit access requests to Admin to collaborate with unassigned employees.
   - Admin can approve or reject. When rejecting, Admin must provide a clear reason that is saved, audited, and displayed to the Lead.
6. **Recycle Bin (Soft-Delete):**
   - Deleted folders and files are safely kept in the Recycle Bin with 1-click **Restore** or **Purge**.
7. **Comprehensive Audit Trail:**
   - Real-time immutable activity log for `LOGIN`, `VIEW_SECRET`, `COPY_SECRET`, `COMMIT_ENV`, `DELETE_ENV_FILE`, `SHARE_FOLDER`, `REQUEST_ACCESS`, `ACCESS_APPROVED`, and `ACCESS_REJECTED`.

---

## 🌐 Production Deployment Guide

### Part 1: Deploy Backend to Render

1. Create a new **Web Service** on [Render](https://render.com).
2. Connect your GitHub repository: `https://github.com/ghanashyamauti/Shakham_Vault`.
3. Configure the service settings:
   - **Name:** `shakham-vault-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add the following **Environment Variables** in Render's dashboard:
   - `ENVIRONMENT`: `production`
   - `DATABASE_URL`: Your PostgreSQL / Neon database connection string (e.g. `postgresql://user:password@ep-...neon.tech/neondb?sslmode=require`)
   - `SECRET_KEY`: Generate a 32+ character random string (e.g. `python -c "import secrets; print(secrets.token_urlsafe(48))"`)
   - `AES_KEY_BASE64`: A 32-byte Base64 encryption key (e.g. `python -c "from cryptography.hazmat.primitives.ciphers.aead import AESGCM; import base64; print(base64.b64encode(AESGCM.generate_key(256)).decode())"`)
   - `ALLOWED_ORIGINS`: Comma-separated list of your frontend URLs (e.g. `https://your-frontend.vercel.app,http://localhost:5173`)
   - `INITIAL_ADMIN_EMAIL`: `admin@yourdomain.com`
   - `INITIAL_ADMIN_PASSWORD`: Secure initial password
   - `INITIAL_ADMIN_NAME`: `Admin`
   - `AUTH_RATE_LIMIT_PER_MINUTE`: `10`
   - `MAX_PAYLOAD_SIZE_MB`: `2`
5. Click **Deploy**. Note your backend URL (e.g. `https://shakham-vault-backend.onrender.com`).

---

### Part 2: Deploy Frontend to Vercel

1. Import your repository into [Vercel](https://vercel.com).
2. Configure project settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Add the **Environment Variable**:
   - `VITE_API_URL`: `https://shakham-vault-backend.onrender.com` (your Render backend URL)
4. Click **Deploy**.
5. Once Vercel assigns your domain (e.g. `https://shakham-vault.vercel.app`), add that domain to `ALLOWED_ORIGINS` in your Render backend settings.

---

## 🏃 Local Development

### Option A: Using Runner Scripts
- **Backend:** Run `.\run_backend.ps1` or double-click `run_backend.bat`.
- **Frontend:** Run `.\run_frontend.ps1` or double-click `run_frontend.bat`.

### Option B: Manual Terminal Execution
```bash
# Backend
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd frontend
npm install
npm run dev
```
