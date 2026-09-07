import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuth";
import { formatDate } from "@/lib/workflow";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — ServiceDesk" },
      { name: "description", content: "Updates on your employee requests and newly assigned approval tasks." },
      { property: "og:title", content: "Notifications — ServiceDesk" },
      { property: "og:description", content: "Request submissions, approvals, rejections and assignments." },
    ],
  }),
  component: Notifications,
});

function Notifications() {
  const { user } = useAuthUser();
  const queryClient = useQueryClient();

  const notifications = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, read, created_at, request_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!notifications.data?.some((n) => !n.read)) return;
    supabase
      .from("notifications")
      .update({ read: true })
      .eq("read", false)
      .then(() => queryClient.invalidateQueries({ queryKey: ["unread"] }));
  }, [notifications.data, queryClient]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      {notifications.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !notifications.data?.length ? (
        <p className="panel p-10 text-center text-sm text-muted-foreground">No notifications yet.</p>
      ) : (
        <ul className="space-y-2">
          {notifications.data.map((n) => {
            const content = (
              <div className={`panel p-4 ${n.read ? "" : "border-l-4 border-l-primary"}`}>
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(n.created_at)}</p>
              </div>
            );
            return (
              <li key={n.id}>
                {n.request_id ? (
                  <Link to="/requests/$id" params={{ id: n.request_id }}>
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
