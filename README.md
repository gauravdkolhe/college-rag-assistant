# CampusDesk · Student Information System

A student information system built on the requested three-tier architecture:

```text
Web browser → Netlify React frontend → Render Express REST API → MongoDB Atlas
```

## Features

- Overview dashboard with student, department, section, and semester statistics.
- Student create, read, search, update, and delete; student records are addressable by student ID or MongoDB ID.
- Search across student IDs, names, email addresses, and sections; filter by department.
- Department management with editable section lists. A new database is initialized with a Computer Science and Engineering department and sections A and B.
- Department sections cannot be removed while students are enrolled, and departments with students cannot be deleted.
- Server-side validation, duplicate ID/email protection, safe API errors, security headers, rate limiting, and an explicit CORS allowlist.

## Run locally

Requirements: Node.js 18.11 or later and a MongoDB Atlas connection string.

1. Install dependencies from the project root:

   ```sh
   npm install
   ```

2. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI` to your Atlas connection string. Set `FRONTEND_URL=http://localhost:5173` for local development. Keep `.env` private.

3. Start the API and frontend:

   ```sh
   npm run dev
   ```

   The frontend runs at `http://localhost:5173`, the API at `http://localhost:5000`, and its health endpoint is `http://localhost:5000/health`.

4. Create, search, update, and delete students through the web app. When creating an Atlas database for the first time, the API creates the starter CSE department and A/B sections.

## REST API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/students` | List students; optional `q`, `department`, and `section` filters |
| `GET` | `/api/students/:id` | Retrieve by MongoDB ID or student ID |
| `POST` | `/api/students` | Add a student |
| `PUT` | `/api/students/:id` | Update a student |
| `DELETE` | `/api/students/:id` | Delete a student |
| `GET` | `/api/departments` | List departments and student counts |
| `GET` | `/api/departments/:id` | Retrieve a department |
| `POST` | `/api/departments` | Create a department |
| `PUT` | `/api/departments/:id` | Update department name or sections |
| `DELETE` | `/api/departments/:id` | Delete a department with no enrolled students |

Student records include `studentId`, `name`, `email`, `department` (department ID), `section`, `semester`, and optional `contact`. Department records include `name` and a `sections` array.

## Deploy the three tiers

1. **MongoDB Atlas:** Create a database user with only the required database permissions, allow network access from the API host, and use the `studentDB` database in the connection string.
2. **Render backend:** Create a Blueprint from this repository using the root `render.yaml`. Set `MONGODB_URI` to the Atlas URI and `FRONTEND_URL` to the exact Netlify site origin. Multiple exact origins can be comma-separated. The Blueprint configures the backend root directory, install/build/start commands, and `/health` health check. Render provides `PORT`.
3. **Netlify frontend:** Deploy from the repository root as a Vite site. Set the build command to `npm run build`, the publish directory to `frontend/dist`, and `VITE_API_URL` to the Render service origin (for example, `https://your-service.onrender.com`). Redeploy after setting environment variables.
4. Verify `https://your-service.onrender.com/health`, then test student and department CRUD operations from the deployed frontend and confirm the records in Atlas.

The frontend only communicates with the REST API and contains no database credentials. The backend refuses to start without `MONGODB_URI` and only accepts browser origins listed in `FRONTEND_URL`.
