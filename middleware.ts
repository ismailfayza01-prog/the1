import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Define protected routes and their required roles
  const protectedRoutes = [
    { prefix: '/admin/dashboard', role: 'admin', loginPath: '/admin' },
    { prefix: '/business/dashboard', role: 'business', loginPath: '/business' },
    { prefix: '/rider/dashboard', role: 'rider', loginPath: '/rider' },
  ];

  // Check if current path is a protected route
  const routeMatch = protectedRoutes.find(route => path.startsWith(route.prefix));

  if (!routeMatch) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Check auth status
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Not logged in -> redirect to specific login page
    return NextResponse.redirect(new URL(routeMatch.loginPath, request.url));
  }

  // Get user profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== routeMatch.role) {
    // Wrong role -> redirect back to their own portal or home
    if (profile?.role === 'admin') return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    if (profile?.role === 'business') return NextResponse.redirect(new URL('/business/dashboard', request.url));
    if (profile?.role === 'rider') return NextResponse.redirect(new URL('/rider/dashboard', request.url));

    // Fallback
    return NextResponse.redirect(new URL(routeMatch.loginPath, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
