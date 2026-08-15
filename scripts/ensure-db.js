#!/usr/bin/env node
/**
 * Preflight for `npm run dev`: make sure the database in backend/.env is actually
 * reachable before uvicorn starts, so a stopped Docker daemon surfaces as a
 * readable message instead of a connection traceback.
 */
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const envFile = path.join(root, 'backend', '.env')

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])
const READY_TIMEOUT_SECONDS = 60

function fail(message, hints = []) {
  console.error(`\n✗ ${message}`)
  for (const hint of hints) console.error(`  → ${hint}`)
  console.error('')
  process.exit(1)
}

function readDatabaseUrl() {
  if (!fs.existsSync(envFile)) return null
  for (const rawLine of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator === -1) continue
    if (line.slice(0, separator).trim() !== 'DATABASE_URL') continue
    return line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return null
}

function docker(args, opts = {}) {
  return spawnSync('docker', args, { cwd: root, encoding: 'utf8', ...opts })
}

const databaseUrl = readDatabaseUrl()

if (!databaseUrl) {
  console.log('• No DATABASE_URL in backend/.env — using the SQLite default.')
  process.exit(0)
}

// Normalize Supabase-style postgres:// the same way backend/app/config.py does.
const normalized = databaseUrl.startsWith('postgres://')
  ? `postgresql://${databaseUrl.slice('postgres://'.length)}`
  : databaseUrl

if (!normalized.startsWith('postgresql://')) {
  console.log(`• DATABASE_URL is not Postgres (${normalized.split(':')[0]}) — skipping Docker.`)
  process.exit(0)
}

let parsed
try {
  parsed = new URL(normalized)
} catch {
  fail(`Could not parse DATABASE_URL in backend/.env: ${normalized}`)
}

const host = parsed.hostname
const port = parsed.port || '5432'

if (!LOCAL_HOSTS.has(host)) {
  console.log(`• DATABASE_URL points at a remote host (${host}) — skipping local Docker Postgres.`)
  process.exit(0)
}

const user = decodeURIComponent(parsed.username) || 'yourcookmate'
const database = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || 'yourcookmate'

if (docker(['info'], { stdio: 'ignore' }).status !== 0) {
  fail('Docker is not running, so local Postgres cannot start.', [
    'Start Docker Desktop, then re-run: npm run dev',
    'Or point DATABASE_URL in backend/.env at another database.',
  ])
}

const up = docker(['compose', 'up', '-d', 'postgres'])
if (up.status !== 0) {
  fail('Failed to start the postgres container.', [
    (up.stderr || up.stdout || '').trim() || 'docker compose up -d postgres failed',
  ])
}

process.stdout.write(`• Waiting for Postgres at ${host}:${port} `)
for (let attempt = 0; attempt < READY_TIMEOUT_SECONDS; attempt++) {
  const ready = docker(
    ['compose', 'exec', '-T', 'postgres', 'pg_isready', '-U', user, '-d', database],
    { stdio: 'ignore' },
  )
  if (ready.status === 0) {
    console.log(`— ready (${database} as ${user})`)
    process.exit(0)
  }
  process.stdout.write('.')
  spawnSync('sleep', ['1'])
}

console.log('')
fail(`Postgres did not become ready within ${READY_TIMEOUT_SECONDS}s.`, [
  'Check container logs: docker compose logs postgres',
  `Expected database "${database}" and user "${user}" from backend/.env`,
])
