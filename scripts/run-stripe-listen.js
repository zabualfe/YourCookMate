#!/usr/bin/env node
/**
 * Forwards Stripe test webhooks to the local API during `npm run dev`.
 * Skips quietly if Stripe isn't configured or the CLI isn't installed.
 */
const { spawn, execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const envFile = path.join(root, 'backend', '.env')
const FORWARD_TO = 'http://127.0.0.1:8000/billing/webhook'
const EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
]

function readEnv(name) {
  if (!fs.existsSync(envFile)) return null
  for (const rawLine of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator === -1) continue
    if (line.slice(0, separator).trim() !== name) continue
    return line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return null
}

function writeEnv(name, value) {
  if (!fs.existsSync(envFile)) return
  const lines = fs.readFileSync(envFile, 'utf8').split('\n')
  let found = false
  const next = lines.map((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return line
    const separator = trimmed.indexOf('=')
    if (separator === -1) return line
    if (trimmed.slice(0, separator).trim() !== name) return line
    found = true
    return `${name}=${value}`
  })
  if (!found) {
    if (next.length && next[next.length - 1] !== '') next.push('')
    next.push(`${name}=${value}`)
  }
  fs.writeFileSync(envFile, next.join('\n'))
}

function findStripeBin() {
  const candidates = ['/opt/homebrew/bin/stripe', '/usr/local/bin/stripe']
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  try {
    const which = process.platform === 'win32' ? 'where stripe' : 'command -v stripe'
    const found = execSync(which, { encoding: 'utf8' }).trim().split('\n')[0]
    return found || null
  } catch {
    return null
  }
}

function stopStaleListeners() {
  if (process.platform === 'win32') return
  try {
    execSync('pkill -f "stripe listen --forward-to"', { stdio: 'ignore' })
  } catch {
    // nothing to stop
  }
}

const secretKey = readEnv('STRIPE_SECRET_KEY')
if (!secretKey) {
  console.log('Stripe listen skipped — STRIPE_SECRET_KEY is not set in backend/.env')
  process.exit(0)
}

const stripeBin = findStripeBin()
if (!stripeBin) {
  console.log('Stripe listen skipped — install the Stripe CLI: brew install stripe/stripe-cli/stripe')
  process.exit(0)
}

stopStaleListeners()

const proc = spawn(
  stripeBin,
  [
    'listen',
    '--api-key',
    secretKey,
    '--forward-to',
    FORWARD_TO,
    '--events',
    EVENTS.join(','),
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
)

function onOutput(chunk, stream) {
  const text = chunk.toString()
  stream.write(text)
  const match = text.match(/whsec_[A-Za-z0-9]+/)
  if (!match) return
  const current = readEnv('STRIPE_WEBHOOK_SECRET')
  if (current === match[0]) return
  writeEnv('STRIPE_WEBHOOK_SECRET', match[0])
  console.log('Updated STRIPE_WEBHOOK_SECRET in backend/.env — restart the backend if webhook verification fails')
}

proc.stdout.on('data', (chunk) => onOutput(chunk, process.stdout))
proc.stderr.on('data', (chunk) => onOutput(chunk, process.stderr))

proc.on('exit', (code) => process.exit(code ?? 0))

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    proc.kill(signal)
  })
}
