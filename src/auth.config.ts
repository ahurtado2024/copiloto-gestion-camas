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
          token.role = (user as any).role;
          token.userId = (user as any).id;
          token.name = user.name;
          token.email = user.email;
        }
        return token;
      },

    async session({ session, token }) {
        if (session.user) {
          // En NextAuth 5 (beta), la forma correcta de extender el objeto es via 'any'
          // para evitar conflictos con la interfaz estricta AdapterUser.
          (session.user as any).role = token.role;
          (session.user as any).id = token.userId;
        }
        return session;
      },
  },
  providers: [],
} satisfies NextAuthConfig;

export default authConfig;