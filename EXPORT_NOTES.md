# TorqueShed Export Notes

This document describes how to cleanly export and deploy this project.

## Folders That MUST NOT Be Included in Exports

These folders contain local/editor/runtime state and should be excluded:

- `.git/` - Git repository data (recreate with `git init` if needed)
- `.config/` - Local editor configuration
- `.local/` - Local runtime data
- `.expo/` - Expo cache and local state
- `.cache/` - Build cache files
- `node_modules/` - Dependencies (reinstall with `npm install`)
- `dist/` - Generic build output
- `build/` - Build artifacts
- `server_dist/` - Server build output (regenerate with `npm run build:server`)
- `static-build/` - Expo web build output (regenerate with `npm run build:web`)
- `*.log` - Log files
- `.DS_Store` - macOS Finder metadata
- `.replit` - Replit-specific configuration
- `replit.nix` - Replit Nix configuration
- `.upm/` - Replit package manager cache
- `tmp/`, `temp/` - Temporary files

## Files/Folders That MUST Be Included

These are required to run the project:

### Core Source Code
- `client/` - React Native/Expo frontend code
- `server/` - Express.js backend code
- `shared/` - Server-only shared code (Drizzle schema, TorqueAssist types)
- `scripts/` - Build scripts

### Configuration
- `package.json` - Root dependencies and scripts
- `package-lock.json` - Dependency lockfile
- `tsconfig.json` - TypeScript configuration
- `babel.config.js` - Babel configuration
- `drizzle.config.ts` - Database ORM configuration
- `eslint.config.js` - Linting configuration
- `app.json` - Expo app configuration

### Assets
- `assets/` - Static assets (images, fonts)
- `design_guidelines.md` - Design system documentation

### Database
- `shared/schema.ts` - Drizzle ORM schema (migrations auto-generated)
- `supabase/` - Supabase configuration (if using Supabase)

### Documentation
- `replit.md` - Project documentation
- `docs/` - Additional documentation
- `EXPORT_NOTES.md` - This file

## Clean Export Checklist

Before exporting or deploying, verify:

- [ ] All source code is committed (client/, server/, shared/)
- [ ] package.json and package-lock.json are included
- [ ] Configuration files are included (tsconfig.json, app.json, etc.)
- [ ] Assets folder is included
- [ ] No node_modules/ in the export
- [ ] No .expo/ or other cache folders
- [ ] No build artifacts (dist/, build/, server_dist/, static-build/)
- [ ] No log files (*.log)
- [ ] No .git/ folder (unless transferring repo)
- [ ] No .config/, .local/, .cache/ folders
- [ ] Environment variables documented (not included in export)

## Required Environment Variables

The following environment variables must be set in your deployment environment:

- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `SUPABASE_JWT_SECRET` - Supabase JWT verification key
- `NODE_ENV` - Set to "production" for deployments
- `PORT` - Server port (defaults to 5000)

Optional:
- `REDIS_URL` - For distributed rate limiting (multi-instance deployments)

## Build Commands

```bash
# Install dependencies
npm install

# Clean build artifacts and caches (run manually)
rm -rf node_modules/.cache .expo .cache dist build server_dist static-build *.log .tsbuildinfo

# Build Expo web app (static build for production)
npm run expo:static:build

# Build server for production
npm run server:build

# Run production server
npm run server:prod
```

## Deployment Steps

1. Export clean source (use checklist above)
2. Set environment variables in deployment platform
3. Run `npm install`
4. Run `npm run expo:static:build` (builds static frontend to static-build/)
5. Run `npm run server:build` (builds server bundle to server_dist/)
6. Run `npm run server:prod` (starts production server)

The server serves both the API and the static Expo web build on port 5000.
