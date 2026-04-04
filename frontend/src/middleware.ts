// frontend/src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED  = ['/dashboard', '/projects', '/units', '/customers', '/reservations', '/sales', '/reports', '/settings', '/onboarding']
const GUEST_ONLY = ['/auth']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Not logged in — redirect to /auth for all protected routes
  if (!user && PROTECTED.some(p => path === p || path.startsWith(p + '/'))) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  // Logged in — redirect away from guest-only pages
  if (user && GUEST_ONLY.some(p => path === p || path.startsWith(p + '/'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Logged in on a protected route — check if they have a profile
  if (user && PROTECTED.some(p => path === p || path.startsWith(p + '/'))) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    const onOnboarding = path === '/onboarding' || path.startsWith('/onboarding/')

    if (!profile && !onOnboarding) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
    if (profile && onOnboarding) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
