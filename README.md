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

- Node 24 LTS (`app/.nvmrc` pins it; run `nvm use` in `app/`)
- Expo Go on your iPhone, signed in to your Expo account. Also run `npx expo login` on the computer.

## Running the app

```bash
cd app
npx expo start
```

Scan the QR code with the iPhone camera to open the app in Expo Go. The App Store version of Expo Go only supports the
latest SDK, so after a new SDK release run `npx expo install expo@latest && npx expo install --fix`.

## Development

Run every check before opening a PR:

```bash
make pre-pr
```

Work is tracked in the [DIG Jira project](https://taylorantoniohardin.atlassian.net/jira/software/projects/DIG/boards/3).
