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
cd app
npx expo start
```

Scan the QR code with the iPhone camera to open the app in Expo Go. The App Store version of Expo Go only supports the
latest SDK, so after a new SDK release run `npx expo install expo@latest && npx expo install --fix`.

CI does not check Expo package versions because new Expo patch releases would fail it at random. After upgrading
Expo or adding a package, run `npm run deps:check` in `app` and fix any mismatches with `npx expo install --fix`.

## End-to-end tests

See `app/e2e/README.md` for how to run the Maestro flows on the iOS Simulator.

## Backend setup

Run these on the Linux PC that hosts the backend.

1. Install ffmpeg, cmake, and the CUDA toolkit (the PC has CUDA 12.6 and an RTX 3060):

   ```bash
   sudo apt install ffmpeg cmake
   ```

2. Build Whisper with GPU support and download the model:

   ```bash
   make -C backend whisper-build whisper_cuda=1
   make -C backend whisper-model whisper_model_name=large-v3-turbo
   ```

3. Create the env file, then fill in the values. Generate `DIGDAYS_KEY` with `openssl rand -hex 32`.

   ```bash
   mkdir -p ~/.config/digdays
   cp backend/deploy/env.example ~/.config/digdays/env
   chmod 600 ~/.config/digdays/env
   ```

4. Install and start the service, and keep it running after reboots and logouts:

   ```bash
   make -C backend install
   sudo loginctl enable-linger "$USER"
   journalctl --user -u digdays -f
   ```

5. Tailscale: install it on the PC and the iPhone, and enable MagicDNS and HTTPS certificates in the admin console.
   Then publish the backend and check it:

   ```bash
   tailscale serve --bg 8080
   tailscale serve status
   ```

6. Verify. Without the key the same request returns 401.

   ```bash
   curl -H "Authorization: Bearer $DIGDAYS_KEY" https://<pc>.<tailnet>.ts.net/health
   ```

To run the live test against the real Claude API:

```bash
ANTHROPIC_API_KEY=... make -C backend test-live whisper_cuda=1 whisper_model_name=large-v3-turbo
```

## Development

Run every check before opening a PR:

```bash
make pre-pr
```

Work is tracked in the [DIG Jira project](https://taylorantoniohardin.atlassian.net/jira/software/projects/DIG/boards/3).
