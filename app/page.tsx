import { getSupabaseServer } from "@/lib/supabase/serverClient";
import HomeClient from "./HomeClient";
import LoginForm from "./LoginForm";

export default async function Page() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <LoginForm />;
  return <HomeClient userEmail={user.email ?? ""} />;
}
