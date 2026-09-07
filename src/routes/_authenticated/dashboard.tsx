import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Inbox, FileText, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useMyRoles } from "@/hooks/useAuth";
import { formatDate, statusLabels, statusTone } from "@/lib/workflow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ServiceDesk" },
      { name: "description", content: "Your submitted requests and pending approval tasks at a glance." },
      { property: "og:title", content: "Dashboard — ServiceDesk" },
      { property: "og:description", content: "Track employee request status and pending approvals." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuthUser();
  const { data: roles } = useMyRoles(user?.id);

  const myRequests = useQuery({
    queryKey: ["my-requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, status, created_at, comments, request_types(name), departments(name)")
        .eq("employee_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const pendingCount = useQuery({
    queryKey: ["pending-count", roles],
    enabled: !!roles?.length,
    queryFn: async () => {
      const { count } = await supabase
        .from("request_approvals")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .in("approver_role", roles!);
      return count ?? 0;
    },
  });

  const open = (myRequests.data ?? []).filter((r) => r.status === "pending" || r.status === "in_progress");
  const done = (myRequests.data ?? []).filter((r) => r.status === "closed" || r.status === "approved");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount.data
              ? `You have ${pendingCount.data} request${pendingCount.data === 1 ? "" : "s"} waiting for your approval.`
              : "No approvals are waiting on you right now."}
          </p>
        </div>
        <Button asChild>
          <Link to="/requests/new">
            <Plus className="size-4" /> New request
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={FileText} label="Open requests" value={open.length} />
        <StatCard icon={CheckCircle2} label="Completed" value={done.length} />
        <StatCard icon={Inbox} label="Pending my approval" value={pendingCount.data ?? 0} to="/approvals" />
      </div>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold">My requests</h2>
        </div>
        {myRequests.isLoading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !myRequests.data?.length ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            You haven’t submitted any requests yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {myRequests.data.map((r) => (
              <li key={r.id}>
                <Link
                  to="/requests/$id"
                  params={{ id: r.id }}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.request_types?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.departments?.name} · {formatDate(r.created_at)}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusTone(r.status)}`}>
                    {statusLabels[r.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
  to?: "/approvals";
}) {
  const body = (
    <div className="panel flex items-center gap-4 p-5">
      <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-2xl font-semibold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}
