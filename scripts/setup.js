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

function parsePythonVersion(text) {
  const match = String(text || '').match(/Python\s+(\d+)\.(\d+)\.(\d+)/i)
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

function isAtLeast(version, major, minor) {
  if (!version) return false
  if (version.major !== major) return version.major > major
  return version.minor >= minor
}

function pythonVersion(command, args = []) {
  const result = spawnSync(command, [...args, '--version'], { encoding: 'utf8' })
  if (result.error || result.status !== 0) return null
  return parsePythonVersion(`${result.stdout || ''}${result.stderr || ''}`)
}

function resolvePython() {
  // Prefer an explicit 3.12+ binary. Bare `python3` on macOS often points at
  // Apple's Command Line Tools Python 3.9, which is too old for this project.
  const candidates = isWin
    ? [
        { command: 'py', args: ['-3.12'], label: 'py -3.12' },
        { command: 'py', args: ['-3'], label: 'py -3' },
        { command: 'python', args: [], label: 'python' },
      ]
    : [
        { command: 'python3.12', args: [], label: 'python3.12' },
        { command: 'python3.13', args: [], label: 'python3.13' },
        { command: 'python3.14', args: [], label: 'python3.14' },
        { command: 'python3', args: [], label: 'python3' },
      ]

  for (const candidate of candidates) {
    const version = pythonVersion(candidate.command, candidate.args)
    if (isAtLeast(version, 3, 12)) {
      return { ...candidate, version }
    }
  }
  return null
}

step('Checking Python')
const resolved = resolvePython()
if (!resolved) {
  console.error('Python 3.12+ is required (Apple\'s /usr/bin/python3 is often 3.9 and will not work).')
  console.error('Install with: brew install python@3.12')
  console.error('Then re-run: npm run setup')
  process.exit(1)
}
console.log(`Using ${resolved.label} → Python ${resolved.version.major}.${resolved.version.minor}.${resolved.version.patch}`)

const existingVenvVersion = fs.existsSync(venvPython()) ? pythonVersion(venvPython()) : null
const venvNeedsRebuild =
  !existingVenvVersion || !isAtLeast(existingVenvVersion, 3, 12)

step('Backend virtualenv')
if (venvNeedsRebuild) {
  if (fs.existsSync(venvDir)) {
    console.log(
      `Recreating .venv (was Python ${
        existingVenvVersion
          ? `${existingVenvVersion.major}.${existingVenvVersion.minor}.${existingVenvVersion.patch}`
          : 'unknown'
      }, need 3.12+)`,
    )
    fs.rmSync(venvDir, { recursive: true, force: true })
  }
  const venvArgs = [...resolved.args, '-m', 'venv', '.venv']
  run(`${resolved.command} ${venvArgs.join(' ')}`, { cwd: backend })
} else {
  console.log(
    `Reusing existing .venv (Python ${existingVenvVersion.major}.${existingVenvVersion.minor}.${existingVenvVersion.patch})`,
  )
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
