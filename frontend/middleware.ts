import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  // Define protected routes
  const protectedRoutes = [
    '/dashboard',
    '/settings',
    '/profile',
    '/redaction-windsurf', // Protect redaction tool for authenticated users
  ];

  // Define public routes that authenticated users shouldn't access
  const authRoutes = ['/auth/signin', '/auth/signup'];

  // Check if current path is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );

  // Check if current path is auth route
  const isAuthRoute = authRoutes.some(route => 
    pathname.startsWith(route)
  );

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !isAuthenticated) {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect authenticated users away from auth routes
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
});

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    // Protect dashboard and related routes
    "/dashboard/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/redaction-windsurf/:path*",
    // Auth routes for redirect logic
    "/auth/signin",
    "/auth/signup",
  ],
};
