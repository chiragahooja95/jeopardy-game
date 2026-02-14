# Cloud Deploy (Render)

This project is configured to deploy as a single web service:

- Node backend (`apps/server`)
- Built frontend (`apps/client/dist`) served by the backend
- Socket.IO on the same origin/port

## 1. Push to GitHub

Push `/Users/chirag/projects/jeopardy-game` to a GitHub repository.

## 2. Deploy on Render

1. Open Render dashboard.
2. Click **New** -> **Blueprint**.
3. Connect your GitHub repo.
4. Render will detect `render.yaml`.
5. Create the service.

Render will run:

- Build: `npm ci && npm run build`
- Start: `npm run start`
- Health: `/health`

## 3. Persistent data

`render.yaml` mounts a persistent disk at:

`/opt/render/project/src/apps/server/data`

Your SQLite DB (`jeopardy.db`) lives there, so player stats survive restarts.

## 4. Verify after deploy

- Health check: `https://<your-render-url>/health` should return `{"ok":true}`
- Open app: `https://<your-render-url>`
- Create room and join from another device

## Notes

- No `VITE_SOCKET_URL` is required for this setup.
- In production, the client connects to `window.location.origin` for Socket.IO.
