#!/usr/bin/env node
const { spawn, execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const backend = path.join(__dirname, '..', 'backend')
const isWin = process.platform === 'win32'
const venvPython = isWin
  ? path.join(backend, '.venv', 'Scripts', 'python.exe')
  : path.join(backend, '.venv', 'bin', 'python')

if (!fs.existsSync(venvPython)) {
  console.error('Backend not set up. Run: npm run setup')
  process.exit(1)
}

function freePort(port) {
  try {
    if (isWin) {
      execSync(
        `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port}') do taskkill /F /PID %a`,
        { stdio: 'ignore', shell: 'cmd.exe' },
      )
    } else {
      for (let attempt = 0; attempt < 5; attempt++) {
        let pids = ''
        try {
          pids = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim()
        } catch {
          return
        }
        if (!pids) return
        for (const pid of pids.split('\n').filter(Boolean)) {
          try {
            execSync(`kill -9 ${pid}`)
          } catch {
            // already gone
          }
        }
        execSync('sleep 0.5')
      }
      console.log(`Freed port ${port} (stopped stale backend)`)
    }
  } catch {
    // port already free
  }
}

freePort(8000)

// Ensure port is actually free before binding
if (!isWin) {
  for (let i = 0; i < 10; i++) {
    try {
      execSync(`lsof -ti :8000`, { stdio: 'ignore' })
      execSync('sleep 0.3')
    } catch {
      break
    }
  }
}

const proc = spawn(
  venvPython,
  ['-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000', '--host', '0.0.0.0'],
  { cwd: backend, stdio: 'inherit' },
)

proc.on('exit', (code) => process.exit(code ?? 0))
