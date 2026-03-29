---
name: mongodb-migration
description: "Automated MongoDB migration agent: Exports current cluster, imports to client cluster, updates .env and Render credentials. Use when: migrating MongoDB to client account."
---

# MongoDB Migration Agent

Automates complete MongoDB handoff to client's Atlas cluster.

## Prerequisites

- Client MongoDB cluster created (M0 free tier)
- Client user `oxford_admin` created with password
- Client IP whitelisted
- Client connection string obtained

## Process

1. **Export** current database via `mongodump`
2. **Import** to client cluster via `mongorestore`
3. **Update** `Backend/.env` with new credentials
4. **Update** Render environment variable
5. **Verify** connection in logs

## Input Parameters

- `SOURCE_URI`: Current MongoDB URI (with password)
- `DEST_URI`: Client MongoDB URI (with password)
- `BACKUP_DIR`: Output directory for dump (default: `./oxford-backup`)

## Output

- Backup directory with BSON dump
- Updated `.env` file
- Confirmation of import success
- Render auto-redeploy initiated

## Execution

Invoke via chat: `/mongodb-migration`

Fill in prompts for source/destination URIs and client password.
