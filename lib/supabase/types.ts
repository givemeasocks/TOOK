export type MemoRow = {
  id: string;
  content: string;
  summary: string | null;
  category: string | null;
  category_edited: boolean;
  source: "manual";
  created_at: string;
};

export type DrawerMemberRow = {
  id: string;
  drawer_id: string;
  user_id: string | null;
  invited_email: string;
  status: "pending" | "accepted";
  created_at: string;
  last_visited_at: string | null;
};
