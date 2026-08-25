import type { SupabaseClient } from "@supabase/supabase-js";

/** 닉네임을 가져오고, 없으면(예: 마이그레이션 이전에 가입했거나 백필이 아직 안 붙은 경우) 이메일 앞부분으로 만들어서 저장해준다. */
export async function getOrCreateNickname(supabase: SupabaseClient, userId: string, email: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("nickname").eq("user_id", userId).maybeSingle();
  if (data?.nickname) return data.nickname;

  const fallback = email.split("@")[0] || "익명";
  await supabase.from("profiles").upsert({ user_id: userId, nickname: fallback });
  return fallback;
}
