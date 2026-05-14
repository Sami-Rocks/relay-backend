# Relay Backend

Clean Express/Prisma base for the Relay poll and survey platform.

## Scripts

- `npm run dev` starts the API server.
- `npx prisma generate` regenerates the Prisma client after schema changes.

## Endpoints

- `GET /` returns API status metadata.
- `GET /health` returns a simple health check.
