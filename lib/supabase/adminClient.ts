import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * RLS를 우회하는 서비스 롤 클라이언트. 로그인한 사용자 요청(API 라우트)에는 절대 쓰지 말 것 —
 * 크론 배치처럼 여러 사용자의 데이터를 한 번에 다뤄야 하는 서버 전용 작업에만 쓴다.
 */
export function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
