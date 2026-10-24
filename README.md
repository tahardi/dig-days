# Dig Days

Dig Days is an iPhone app for logging mountain bike trail building. Press Start at the work site, press Stop when you
leave, and describe the day out loud. At home, a small Go backend transcribes the clip with Whisper and uses Claude to
turn it into a work log entry linked to the right trail and feature. The app totals hours and work days for each trail
and feature.

This is a proof of concept for personal use.

## Layout

- `app/`: Expo app (React Native, TypeScript), run in Expo Go
- `backend/`: stateless Go service that turns a voice clip into a draft entry

## Prerequisites

- Go 1.27.1 or newer (`go version` must print `go1.27.1` or later)
- Node 24 LTS (`app/.nvmrc` pins it; run `nvm use` in `app/`)
- Expo Go on your iPhone, signed in to your Expo account. Also run `npx expo login` on the computer.

## Running the app

```bash
make install-app
make start-app
```

Scan the QR code with the iPhone camera to open the app in Expo Go. Press `r` to reload and `Ctrl+C` to stop.
`make start-app` points the app at this PC's backend over Tailscale, using `DIGDAYS_KEY` from `~/.config/digdays/env`,
so there is nothing to type in Settings. The App Store version of Expo Go only supports the latest SDK, so after a new
SDK release run `npx expo install expo@latest && npx expo install --fix`.

CI does not check Expo package versions because new Expo patch releases would fail it at random. After upgrading
Expo or adding a package, run `npm run deps:check` in `app` and fix any mismatches with `npx expo install --fix`.

## End-to-end tests

See `app/e2e/README.md` for how to run the Maestro flows on the iOS Simulator.

## Backend setup

Run these on the Linux PC that hosts the backend.

1. Install ffmpeg, cmake, jq, and the CUDA toolkit (the PC has CUDA 12.6 and an RTX 3060):

   ```bash
   sudo apt install ffmpeg cmake jq
   ```

2. Build Whisper and download the model. GPU support turns on when the CUDA toolkit is found. Every worktree shares
   the build in the main checkout's `backend/.tools/`.

   ```bash
   make -C backend whisper-build whisper-model whisper_model_name=large-v3-turbo
   ```

3. Create the env file, then fill in the values. Generate `DIGDAYS_KEY` with `openssl rand -hex 32`.

   ```bash
   mkdir -p ~/.config/digdays
   cp backend/deploy/env.example ~/.config/digdays/env
   chmod 600 ~/.config/digdays/env
   ```

4. Install the service:

   ```bash
   make install-backend
   ```

5. Tailscale: install it on the PC and the iPhone, and enable MagicDNS and HTTPS certificates in the admin console.
   Let your user run `tailscale serve` without sudo:

   ```bash
   sudo tailscale set --operator="$USER"
   ```

6. Start the backend and publish it on Tailscale:

   ```bash
   make start-backend
   ```

7. Verify. Without the key the same request returns 401.

   ```bash
   curl -H "Authorization: Bearer $DIGDAYS_KEY" https://<pc>.<tailnet>.ts.net/health
   ```

The backend does not start on boot. `make stop-backend` stops it and removes it from Tailscale, so other projects
can use port 8080 and Tailscale's HTTPS port. `make restart-backend` restarts it after an env file change. Watch
the logs with `journalctl --user -u digdays -f`.

To run the live test against the real Claude API, using the key from `~/.config/digdays/env`:

```bash
make -C backend test-live
```

## Development

Run every check before opening a PR:

```bash
make pre-pr
```

Work is tracked in the [DIG Jira project](https://taylorantoniohardin.atlassian.net/jira/software/projects/DIG/boards/3).
