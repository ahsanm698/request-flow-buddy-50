import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuth";
import { roleLabels, uploadAttachments } from "@/lib/workflow";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/requests/new")({
  head: () => ({
    meta: [
      { title: "New request — ServiceDesk" },
      { name: "description", content: "Submit a new employee service request and start its approval workflow." },
      { property: "og:title", content: "New request — ServiceDesk" },
      { property: "og:description", content: "Choose a department and request type to start an approval workflow." },
    ],
  }),
  component: NewRequest,
});

const schema = z.object({
  departmentId: z.string().uuid("Select a department"),
  requestTypeId: z.string().uuid("Select a request type"),
  comments: z.string().trim().max(2000, "Comments must be under 2000 characters"),
});

function NewRequest() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthUser();
  const [departmentId, setDepartmentId] = useState("");
  const [requestTypeId, setRequestTypeId] = useState("");
  const [comments, setComments] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const requestTypes = useQuery({
    queryKey: ["request-types", departmentId],
    enabled: !!departmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_types")
        .select("id, name, description")
        .eq("department_id", departmentId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const workflow = useQuery({
    queryKey: ["workflow", requestTypeId],
    enabled: !!requestTypeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_workflows")
        .select("step_order, approver_role")
        .eq("request_type_id", requestTypeId)
        .order("step_order");
      if (error) throw error;
      return data;
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ departmentId, requestTypeId, comments });
    if (!parsed.success) return toast.error(parsed.error.issues[0]!.message);
    setSaving(true);
    try {
      const paths = files.length ? await uploadAttachments(user!.id, files) : [];
      const { data, error } = await supabase
        .from("requests")
        .insert({
          employee_id: user!.id,
          department_id: parsed.data.departmentId,
          request_type_id: parsed.data.requestTypeId,
          comments: parsed.data.comments || null,
          attachments: paths,
        })
        .select("id")
        .single();
      if (error) throw error;
      await queryClient.invalidateQueries();
      toast.success("Request submitted successfully!");
      navigate({ to: "/requests/$id", params: { id: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit the request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New request</h1>
        <p className="text-sm text-muted-foreground">
          Pick a department, then the type of request you need.
        </p>
      </div>

      <form onSubmit={submit} className="panel space-y-5 p-6">
        <div className="space-y-1.5">
          <Label>Department</Label>
          {departments.isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select
              value={departmentId}
              onValueChange={(v) => {
                setDepartmentId(v);
                setRequestTypeId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent>
                {(departments.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Request type</Label>
          <Select value={requestTypeId} onValueChange={setRequestTypeId} disabled={!departmentId}>
            <SelectTrigger>
              <SelectValue placeholder={departmentId ? "Select a request type" : "Choose a department first"} />
            </SelectTrigger>
            <SelectContent>
              {(requestTypes.data ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!!requestTypes.data?.find((t) => t.id === requestTypeId)?.description && (
            <p className="text-xs text-muted-foreground">
              {requestTypes.data.find((t) => t.id === requestTypeId)?.description}
            </p>
          )}
        </div>

        {!!workflow.data?.length && (
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Approval route</p>
            <ol className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {workflow.data.map((s, i) => (
                <li key={s.step_order} className="flex items-center gap-2">
                  {i > 0 && <span className="text-muted-foreground">→</span>}
                  <span className="rounded-md bg-card px-2 py-1 shadow-xs">{roleLabels[s.approver_role]}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="comments">Comments</Label>
          <Textarea
            id="comments"
            rows={4}
            maxLength={2000}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Add any detail the approvers need (dates, destination, purpose…)"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="files">Attachments (optional)</Label>
          <Input
            id="files"
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {!!files.length && (
            <p className="text-xs text-muted-foreground">{files.length} file(s) selected</p>
          )}
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? "Submitting…" : "Submit request"}
        </Button>
      </form>
    </div>
  );
}
