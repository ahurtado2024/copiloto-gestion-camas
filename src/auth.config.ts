import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt" as const,
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      // Rutas siempre permitidas sin autenticación
      const publicPaths = [
        "/login",
        "/api/auth",
        "/api/health",
        "/api/telegram",
        "/plantilla-hoja-turno.csv",
      ];

      const isPublic = publicPaths.some((p) => pathname.startsWith(p));
      if (isPublic) return true;

      // Si no está logueado, redirigir a login
      if (!isLoggedIn) {
        const loginUrl = new URL("/login", request.nextUrl.origin);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }

      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.role = (user as Record<string, unknown>).role as string;
        token.userId = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).role = token.role;
        (session.user as Record<string, unknown>).id = token.userId;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

export default authConfig;