# Finly Frontend

React-based frontend for the Finly personal finance application.

## Tech Stack

- React 19
- Vite
- Lucide React (icons)
- Recharts (charts)
- Capacitor (mobile)

## Development

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` with API proxy to `http://localhost:3001`.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:3001/api` |

## Build

```bash
npm run build
```

## Docker

```bash
docker build --build-arg VITE_API_BASE_URL=https://api.nidhiflow.in -t finly-frontend .
docker run -p 80:80 finly-frontend
```
