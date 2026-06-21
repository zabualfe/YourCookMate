#!/usr/bin/env node
const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const email = process.argv[2]
if (!email) {
  console.error('Usage: npm run test:smtp -- you@example.com')
  process.exit(1)
}

const backend = path.join(__dirname, '..', 'backend')
const isWin = process.platform === 'win32'
const venvPython = isWin
  ? path.join(backend, '.venv', 'Scripts', 'python.exe')
  : path.join(backend, '.venv', 'bin', 'python')

if (!fs.existsSync(venvPython)) {
  console.error('Run npm run setup first')
  process.exit(1)
}

const result = spawnSync(venvPython, ['-m', 'app.scripts.test_smtp', email], {
  cwd: backend,
  stdio: 'inherit',
  env: { ...process.env, PYTHONPATH: backend },
})

process.exit(result.status ?? 1)
