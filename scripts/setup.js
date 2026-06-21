#!/usr/bin/env node
const { execSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const backend = path.join(root, 'backend')
const web = path.join(root, 'web')
const venvDir = path.join(backend, '.venv')
const isWin = process.platform === 'win32'

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { stdio: 'inherit', ...opts })
}

function venvPython() {
  return isWin
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python')
}

function step(label) {
  console.log(`\n── ${label} ──`)
}

step('Checking Python')
const pythonCheck = spawnSync(isWin ? 'python' : 'python3', ['--version'], { encoding: 'utf8' })
if (pythonCheck.status !== 0) {
  console.error('Python 3 is required. Install from https://python.org')
  process.exit(1)
}
console.log(pythonCheck.stdout.trim() || pythonCheck.stderr.trim())

const python = isWin ? 'python' : 'python3'

step('Backend virtualenv')
if (!fs.existsSync(venvDir)) {
  run(`${python} -m venv .venv`, { cwd: backend })
}

step('Backend dependencies')
run(`"${venvPython()}" -m pip install -r requirements.txt`, { cwd: backend })

step('Backend environment file')
const envFile = path.join(backend, '.env')
const envExample = path.join(backend, '.env.example')
if (!fs.existsSync(envFile) && fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envFile)
  console.log('Created backend/.env from .env.example')
}

step('Web dependencies')
run('npm install', { cwd: web })

step('Database (Docker Postgres)')
try {
  run('docker compose up -d postgres', { cwd: root })
  // wait for postgres
  run('sleep 3')
} catch {
  console.warn('Could not start Postgres via Docker. Ensure DATABASE_URL is reachable.')
}

step('Database tables')
try {
  run(`"${venvPython()}" -m app.scripts.init_db`, { cwd: backend, env: { ...process.env, PYTHONPATH: backend } })
} catch {
  console.warn('Could not init DB yet. Run: npm run db:init after Postgres is up.')
}

step('Root dev dependencies')
run('npm install', { cwd: root })

console.log('\n✓ Setup complete. Run: npm run dev\n')
