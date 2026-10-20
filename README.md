[![Version](https://img.shields.io/github/v/release/Screenly/calendar-app)](https://github.com/Screenly/calendar-app/releases/latest)

# Screenly Calendar App

![Calendar App Preview](/screenshots/weekly-1920x1080.webp)

## Getting Started

```bash
bun install
```

## Deployment

Create and deploy the Edge App locally:

```bash
screenly edge-app create --name calendar --in-place
bun run deploy
screenly edge-app instance create
```

Configure the required settings:

```bash
screenly edge-app setting set ical_url=<YOUR_ICAL_URL>
screenly edge-app setting set bypass_cors=true
```

### CI / CD

This repo uses [Screenly/edge-apps-actions](https://github.com/Screenly/edge-apps-actions) (`@v26.10.0`):

| Workflow                | When it runs                         | Target                             |
| ----------------------- | ------------------------------------ | ---------------------------------- |
| **Initialize Edge App** | Manual (`workflow_dispatch`)         | stage or production (first create) |
| **Update Edge App**     | Push to `main`, or manual            | stage                              |
| **Update Edge App**     | Push of a `v[0-9]*` tag on `main`    | production                         |
| **Checks**              | Push / PR to `main` or `development` | lint, format, test, build          |

GitHub setup (once):

1. Create Environments named `stage` and `production`.
2. Add secret `SCREENLY_API_TOKEN` for both.
3. Run **Initialize Edge App** for stage, then production (leave the Edge App id vars unset on first create).
4. Copy each printed Edge App id into repo variables `STAGE_EDGE_APP_ID` and `PRODUCTION_EDGE_APP_ID`.

### Releasing

Pushes to `main` deploy to stage automatically. To release to production, tag a commit on `main` and push the tag (the workflow refuses tags not on `main`):

```bash
git checkout main && git pull
git tag v26.10.0
git push origin v26.10.0
```

Then publish a GitHub Release whose notes list the pull requests merged since the previous release. Add `--draft` to review the notes before publishing:

```bash
gh release create v26.10.0 --verify-tag --generate-notes --title v26.10.0
```

Use the `vYY.M.PATCH` scheme (e.g. `v26.10.0` for the first release in October 2026, `v26.10.1` for the next one that month).

## Configuration

| Setting             | Description                                                                                            | Type     | Default    |
| ------------------- | ------------------------------------------------------------------------------------------------------ | -------- | ---------- |
| `ical_url`          | iCal feed URL for your calendar (required)                                                             | secret   | -          |
| `calendar_mode`     | View mode: `schedule`, `weekly`, or `daily`                                                            | optional | `schedule` |
| `bypass_cors`       | Enable CORS bypass for iCal URLs that require it                                                       | optional | `true`     |
| `override_locale`   | Override the default locale (e.g. `fr`, `de`)                                                          | optional | `en`       |
| `override_timezone` | Override the default timezone (e.g. `America/New_York`). Defaults to the system timezone if left blank | optional | -          |
| `display_errors`    | Display errors on screen for debugging purposes                                                        | optional | `false`    |
| `sentry_dsn`        | Sentry DSN for error tracking and monitoring                                                           | optional | -          |

## Development

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun run dev
```

Update `mock-data.yml` with your `ical_url` and set `bypass_cors` to `true`.

See [Getting the iCal URL](#getting-the-ical-url) for instructions.

## Linting and Formatting

```bash
bun run lint
bun run format
```

## Testing

```bash
bun test
```

## Screenshots

Generate screenshots at all supported resolutions:

```bash
bun run screenshots
```

Screenshots are saved to the `screenshots/` directory.

## Getting the iCal URL

- Go to your [Google Calendar](https://google.com/calendar).
- On the left sidebar, under "My calendars", select the calendar you want to use.
- Click on the three dots on the right side of the calendar and select "Settings and sharing".
- Scroll down until you see "Secret address in iCal format". Click on the copy button to the right.
- A "Security warning" will appear — click "OK" to continue.
- The secret address will be copied to your clipboard, which you can use in the Edge App settings.
