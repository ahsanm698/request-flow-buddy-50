import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type RequestStatus = Database["public"]["Enums"]["request_status"];

export const roleLabels: Record<AppRole, string> = {
  employee: "Employee",
  manager: "Manager",
  hr: "HR",
  travel_office: "Travel Office",
  admin: "Admin",
};

export const statusLabels: Record<RequestStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  approved: "Approved",
  rejected: "Rejected",
  closed: "Closed",
};

export function statusTone(status: RequestStatus | string) {
  switch (status) {
    case "closed":
    case "approved":
      return "bg-success/12 text-success border-success/30";
    case "rejected":
      return "bg-destructive/12 text-destructive border-destructive/30";
    case "in_progress":
      return "bg-info/12 text-info border-info/30";
    default:
      return "bg-warning/15 text-warning-foreground border-warning/40";
  }
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function uploadAttachments(userId: string, files: File[]) {
  const paths: string[] = [];
  for (const file of files) {
    const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file);
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

export async function signedUrl(path: string) {
  const { data } = await supabase.storage.from("attachments").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function fileNameFromPath(path: string) {
  const base = path.split("/").pop() ?? path;
  return base.replace(/^[0-9a-f-]{36}-/, "");
}
