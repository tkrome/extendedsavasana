# Extended Savasana

A web app for yoga practitioners who want a longer savasana than their YouTube class provides.

Paste any YouTube yoga class URL, set (or auto-detect) the savasana timestamp, choose a duration, and the app seamlessly fades out the yoga video, fades in meditation music, counts down your rest, then fades the yoga video back in exactly where it paused.

[See it in action here](https://www.extendedsavasana.com)

**Stack:** Next.js 15 · React 19 · TypeScript · Tailwind CSS · better-sqlite3 · nginx · Docker Compose · Let's Encrypt

---

## Features

- Auto-detects savasana timestamps from YouTube video descriptions
- Falls back to community-suggested timestamps if none is found
- Option to set the pause point live while watching
- Customizable meditation music (defaults to Marconi Union – Weightless)
- Dark / light mode
- Rate-limited nginx reverse proxy with HTTPS via Let's Encrypt

---

## Prerequisites

- Docker and Docker Compose
- A domain with an A record pointed at your server
- A [YouTube Data API v3 key](https://console.cloud.google.com/apis/library/youtube.googleapis.com)

---

## Deployment (DigitalOcean Droplet or any Linux server)

### 1. Provision a droplet

A 1 GB / 1 vCPU Basic droplet running Ubuntu 22.04+ is sufficient. Enable the firewall to allow ports 22, 80, and 443.

### 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 3. Clone the repo

```bash
git clone https://github.com/your-username/extended-savasana.git
cd extended-savasana
```

### 4. Configure environment variables

```bash
cp .env.example .env
nano .env
```

Set your YouTube Data API v3 key:

```
YOUTUBE_API_KEY=your_key_here
```

### 5. Update domain references

Replace `extendedsavasana.com` with your domain in:

- `nginx/conf.d/default.conf` (server_name directives and redirect targets)
- `init-letsencrypt.sh` (DOMAINS array)

Also set your email in `init-letsencrypt.sh`:

```bash
EMAIL="you@example.com"
```

### 6. Issue SSL certificates

Run this **once** before starting the stack. It checks DNS, spins up nginx with a temporary self-signed cert, issues a real Let's Encrypt cert, then reloads nginx.

```bash
chmod +x init-letsencrypt.sh
./init-letsencrypt.sh
```

> Tip: set `STAGING=1` in the script for a dry run that avoids Let's Encrypt rate limits.

### 7. Start the stack

```bash
docker compose up -d
```

The certbot container automatically renews certificates every 12 hours.

### 8. Verify

```bash
docker compose ps       # all services should be Up / healthy
docker compose logs -f  # tail logs
```

Visit `https://yourdomain.com` — you should see the app over HTTPS.

---

## Local development

```bash
cd app
npm install
YOUTUBE_API_KEY=your_key_here npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Updating

```bash
git pull
docker compose build app
docker compose up -d app
```

---

## Environment variables

| Variable | Description |
|---|---|
| `YOUTUBE_API_KEY` | YouTube Data API v3 key used server-side to fetch video metadata |

---

## License

MIT
