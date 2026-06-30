/**
 * Site-wide password gate for Vercel production (Edge Middleware).
 * Set SITE_PASSWORD in Vercel env vars. Leave unset locally — middleware only runs on Vercel.
 */
export default function middleware(request: Request) {
  const password = process.env.SITE_PASSWORD?.trim()
  if (!password) {
    return
  }

  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6))
      const supplied = decoded.includes(':') ? decoded.slice(decoded.indexOf(':') + 1) : decoded
      if (supplied === password) {
        return
      }
    } catch {
      // Invalid Authorization header — fall through to 401
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Your Cook Mate"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

export const config = {
  matcher: ['/((?!assets/).*)'],
}
