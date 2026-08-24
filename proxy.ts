import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Supabase 세션 쿠키는 만료 전 갱신이 필요한데, 그 갱신을 Server Component에서는 할 수 없어서
// proxy(구 middleware)에서 매 요청마다 대신 처리한다 (Supabase SSR 공식 패턴).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

// api 라우트는 이 프록시가 필요 없다 — Route Handler는 Server Component와 달리 쿠키를 직접 쓸 수
// 있어서 requireUser() 안에서 스스로 세션을 갱신·저장한다. 오히려 여기서 요청을 한 번 더 감싸는
// NextResponse.next({ request })가 multipart/form-data(예: /api/ocr 이미지 업로드) 바디의
// boundary를 깨뜨려서 "no boundary found in multipart body" 에러가 났었음 — api 전체를 제외해서 해결.
export const config = {
  matcher: ["/((?!_next/static|_next/image|icons|character|manifest.webmanifest|sw.js|api).*)"],
};
