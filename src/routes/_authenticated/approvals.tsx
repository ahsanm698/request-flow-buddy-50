import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useMyRoles } from "@/hooks/useAuth";
import { formatDate, roleLabels } from "@/lib/workflow";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Pending approvals — ServiceDesk" },
      { name: "description", content: "Review and action the employee requests assigned to your approval role." },
      { property: "og:title", content: "Pending approvals — ServiceDesk" },
      { property: "og:description", content: "Approve or reject employee requests waiting on your role." },
    ],
  }),
  component: Approvals,
});

function Approvals() {
  const { user } = useAuthUser();
  const { data: roles } = useMyRoles(user?.id);

  const pending = useQuery({
    queryKey: ["pending-approvals", roles],
    enabled: !!roles?.length,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_approvals")
        .select(
          "id, step_order, approver_role, request_id, requests(id, created_at, status, employee_id, request_types(name), departments(name))",
        )
        .eq("status", "pending")
        .in("approver_role", roles!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pending approvals</h1>
        <p className="text-sm text-muted-foreground">
          Steps currently assigned to {(roles ?? []).map((r) => roleLabels[r]).join(", ") || "your role"}.
        </p>
      </div>

      {pending.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !pending.data?.length ? (
        <p className="panel p-10 text-center text-sm text-muted-foreground">
          Nothing is waiting on you. Good work.
        </p>
      ) : (
        <ul className="space-y-3">
          {pending.data.map((a) => (
            <li key={a.id}>
              <Link
                to="/requests/$id"
                params={{ id: a.request_id }}
                className="panel flex flex-wrap items-center gap-3 p-5 transition-colors hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.requests?.request_types?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.requests?.departments?.name} · {formatDate(a.requests?.created_at ?? null)}
                  </p>
                </div>
                <span className="rounded-full border border-info/30 bg-info/12 px-2.5 py-0.5 text-xs font-medium text-info">
                  Step {a.step_order} · {roleLabels[a.approver_role]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
