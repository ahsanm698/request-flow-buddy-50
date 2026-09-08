import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useMyRoles } from "@/hooks/useAuth";
import { roleLabels, type AppRole } from "@/lib/workflow";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const assignable: AppRole[] = ["employee", "manager", "hr", "travel_office", "admin"];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Team roles — ServiceDesk" },
      { name: "description", content: "Assign manager, HR, travel office and admin roles to employees." },
      { property: "og:title", content: "Team roles — ServiceDesk" },
      { property: "og:description", content: "Manage who can approve each workflow step." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuthUser();
  const { data: myRoles, isLoading: rolesLoading } = useMyRoles(user?.id);
  const queryClient = useQueryClient();
  const isAdmin = !!myRoles?.includes("admin");

  const people = useQuery({
    queryKey: ["admin-people"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, name, email").order("name"),
        supabase.rpc("list_user_roles"),
      ]);
      if (error) throw error;
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      }));
    },
  });

  async function toggle(userId: string, role: AppRole, has: boolean) {
    const { error } = has
      ? await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role)
      : await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Roles updated");
    await queryClient.invalidateQueries();
  }

  if (rolesLoading) return <Skeleton className="h-40 w-full" />;
  if (!isAdmin) {
    return (
      <p className="panel p-10 text-center text-sm text-muted-foreground">
        Only administrators can manage team roles.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team roles</h1>
        <p className="text-sm text-muted-foreground">
          Roles decide which approval steps a person can action.
        </p>
      </div>

      {people.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <ul className="space-y-3">
          {(people.data ?? []).map((p) => (
            <li key={p.id} className="panel flex flex-wrap items-center gap-3 p-5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.name || p.email}</p>
                <p className="text-xs text-muted-foreground">{p.email}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {assignable.map((role) => {
                  const has = p.roles.includes(role);
                  return (
                    <Button
                      key={role}
                      size="sm"
                      variant={has ? "default" : "outline"}
                      onClick={() => toggle(p.id, role, has)}
                    >
                      {roleLabels[role]}
                    </Button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
