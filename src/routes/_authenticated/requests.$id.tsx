import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Paperclip, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useMyRoles } from "@/hooks/useAuth";
import {
  fileNameFromPath,
  formatDate,
  roleLabels,
  signedUrl,
  statusLabels,
  statusTone,
  uploadAttachments,
} from "@/lib/workflow";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/requests/$id")({
  head: () => ({
    meta: [
      { title: "Request details — ServiceDesk" },
      { name: "description", content: "Full history, attachments and approval steps for an employee request." },
      { property: "og:title", content: "Request details — ServiceDesk" },
      { property: "og:description", content: "Track each approval step of an employee service request." },
    ],
  }),
  component: RequestDetail,
});

function RequestDetail() {
  const { id } = Route.useParams();
  const { user } = useAuthUser();
  const { data: roles } = useMyRoles(user?.id);
  const queryClient = useQueryClient();
  const [comments, setComments] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const request = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select(
          "id, status, comments, attachments, created_at, updated_at, employee_id, request_types(name, description), departments(name)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const requester = useQuery({
    queryKey: ["requester", request.data?.employee_id],
    enabled: !!request.data?.employee_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name, email")
        .eq("id", request.data!.employee_id)
        .maybeSingle();
      return data;
    },
  });

  const steps = useQuery({
    queryKey: ["steps", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_approvals")
        .select("id, step_order, approver_role, status, comments, attachments, action_date, approver_employee_id")
        .eq("request_id", id)
        .order("step_order");
      if (error) throw error;
      return data;
    },
  });

  const currentStep = (steps.data ?? []).find((s) => s.status === "pending");
  const canAct =
    !!currentStep &&
    !!roles?.some((r) => r === currentStep.approver_role || r === "admin") &&
    request.data?.status !== "rejected" &&
    request.data?.status !== "closed";

  async function act(decision: "approved" | "rejected") {
    setBusy(true);
    try {
      const paths = files.length ? await uploadAttachments(user!.id, files) : [];
      const { error } = await supabase.rpc("act_on_request", {
        _request_id: id,
        _decision: decision,
        ...(comments.trim() ? { _comments: comments.trim() } : {}),
        _attachments: paths,
      });
      if (error) throw error;
      setComments("");
      setFiles([]);
      await queryClient.invalidateQueries();
      toast.success(decision === "approved" ? "Step approved" : "Request rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (request.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!request.data) {
    return <p className="panel p-10 text-center text-sm text-muted-foreground">Request not found.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to dashboard
      </Link>

      <div className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{request.data.request_types?.name}</h1>
            <p className="text-sm text-muted-foreground">
              {request.data.departments?.name} · raised by{" "}
              {requester.data?.name || requester.data?.email || "employee"} ·{" "}
              {formatDate(request.data.created_at)}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(request.data.status)}`}>
            {statusLabels[request.data.status]}
          </span>
        </div>

        {request.data.comments && (
          <p className="mt-4 whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">{request.data.comments}</p>
        )}
        <AttachmentList paths={request.data.attachments} />
      </div>

      <section className="panel overflow-hidden">
        <h2 className="border-b border-border px-5 py-4 font-display text-base font-semibold">Approval workflow</h2>
        <ol className="divide-y divide-border">
          {(steps.data ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap gap-3 px-5 py-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {s.step_order}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{roleLabels[s.approver_role]}</p>
                <p className="text-xs text-muted-foreground">
                  {s.status === "pending" ? "Awaiting decision" : `${s.status} · ${formatDate(s.action_date)}`}
                </p>
                {s.comments && <p className="mt-2 text-sm">{s.comments}</p>}
                <AttachmentList paths={s.attachments} />
              </div>
              <span className={`h-fit rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusTone(s.status)}`}>
                {s.status}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {canAct && (
        <section className="panel space-y-4 p-6">
          <h2 className="font-display text-base font-semibold">
            Your decision · step {currentStep!.step_order} ({roleLabels[currentStep!.approver_role]})
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="decision-comments">Comments</Label>
            <Textarea
              id="decision-comments"
              rows={3}
              maxLength={2000}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Optional note for the requester and later approvers"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="decision-files">Attachments (optional)</Label>
            <Input id="decision-files" type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => act("approved")} disabled={busy}>
              <Check className="size-4" /> Approve
            </Button>
            <Button variant="destructive" onClick={() => act("rejected")} disabled={busy}>
              <X className="size-4" /> Reject
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function AttachmentList({ paths }: { paths: string[] | null }) {
  if (!paths?.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {paths.map((p) => (
        <li key={p}>
          <button
            type="button"
            onClick={async () => {
              const url = await signedUrl(p);
              if (url) window.open(url, "_blank", "noopener");
              else toast.error("Could not open the file");
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-muted"
          >
            <Paperclip className="size-3.5" /> {fileNameFromPath(p)}
          </button>
        </li>
      ))}
    </ul>
  );
}
