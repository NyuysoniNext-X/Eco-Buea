# Direct Node.js Backend

This version removes Firebase/Supabase from the MVP runtime and uses a direct Node.js HTTP server.

## Run

```bash
cd ecocycle-buea
npm start
```

Open:

```txt
http://localhost:3000
```

## API Endpoints

- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/users`
- `GET /api/pickups`
- `POST /api/pickups`
- `PATCH /api/pickups/:id/accept`
- `PATCH /api/pickups/:id/complete`
- `GET /api/smart-bins`
- `GET /api/materials`
- `GET /api/notifications`
- `GET /api/analytics`

## Data storage

Data is persisted to:

```txt
data/db.json
```

This is intentionally simple for MVP/demo use. For production, replace the JSON file adapter with PostgreSQL, MySQL, MongoDB, or SQLite while keeping the same API route contract.

- `POST /api/uploads`
- `GET /api/uploads`
- `PATCH /api/smart-bins/:id`
- `POST /api/materials/:id/bids`
- `GET /api/invoices`
- `POST /api/invoices`
- `GET /api/invoices/:id/html`
- `GET /api/reports/monthly.json`
- `GET /api/reports/monthly.csv`