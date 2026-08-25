import { getSupabaseServer } from "@/lib/supabase/serverClient";
import { getOrCreateNickname } from "@/lib/profile";
import HomeClient from "./HomeClient";
import LoginForm from "./LoginForm";

export default async function Page() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <LoginForm />;
  const nickname = await getOrCreateNickname(supabase, user.id, user.email ?? "");
  return <HomeClient userEmail={user.email ?? ""} userNickname={nickname} />;
}
