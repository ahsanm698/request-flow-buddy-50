import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ClipboardList, Inbox, LayoutDashboard, LogOut, Plus, Users } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useMyProfile, useMyRoles } from "@/hooks/useAuth";
import { roleLabels } from "@/lib/workflow";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/approvals", label: "Approvals", icon: Inbox },
  { to: "/requests/new", label: "New request", icon: Plus },
  { to: "/notifications", label: "Notifications", icon: Bell },
] as const;

const adminNav = { to: "/admin", label: "Team roles", icon: Users } as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthUser();
  const { data: profile } = useMyProfile(user?.id);
  const { data: roles } = useMyRoles(user?.id);

  const { data: unread } = useQuery({
    queryKey: ["unread", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-display text-lg font-semibold">
            <ClipboardList className="size-5 text-sidebar-primary" />
            ServiceDesk
          </Link>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto md:order-2 md:w-auto md:flex-1 md:justify-center">
            {[...nav, ...(roles?.includes("admin") ? [adminNav] : [])].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
              >
                <item.icon className="size-4" />
                {item.label}
                {item.to === "/notifications" && !!unread && (
                  <span className="rounded-full bg-sidebar-primary px-1.5 text-xs font-semibold text-sidebar-primary-foreground">
                    {unread}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="order-2 ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{profile?.name ?? "…"}</p>
              <p className="text-xs text-sidebar-foreground/65">
                {(roles ?? []).map((r) => roleLabels[r]).join(" · ") || "Employee"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
