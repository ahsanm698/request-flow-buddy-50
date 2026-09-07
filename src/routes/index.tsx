import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, GitBranch, ShieldCheck, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ServiceDesk — Employee Request & Approval Workflows" },
      {
        name: "description",
        content:
          "Submit employee service requests like salary certificates and air tickets, and route them through multi-step manager, HR and travel office approvals.",
      },
      { property: "og:title", content: "ServiceDesk — Employee Request & Approval Workflows" },
      {
        property: "og:description",
        content: "Multi-step approval workflows for internal employee service requests.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: GitBranch,
    title: "Multi-step workflows",
    body: "Each request type routes automatically through manager, HR and travel office steps in order.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Employees see their own requests; approvers only see the steps assigned to their role.",
  },
  {
    icon: Bell,
    title: "Live status & alerts",
    body: "Requesters and approvers get notified on every submission, approval and rejection.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="flex items-center gap-2 font-display text-lg font-semibold">
          <ClipboardList className="size-5 text-sidebar-primary" />
          ServiceDesk
        </span>
        <Button asChild variant="secondary">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          Employee service requests, approved without the chasing
        </h1>
        <p className="mt-5 text-lg text-sidebar-foreground/75">
          One portal for certificates, air tickets, reimbursements and equipment — routed through the
          right approvers automatically, with a full audit trail.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">View my requests</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-24 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border border-sidebar-border bg-sidebar-accent p-6">
            <f.icon className="size-5 text-sidebar-primary" />
            <h2 className="mt-3 font-display text-base font-semibold">{f.title}</h2>
            <p className="mt-1.5 text-sm text-sidebar-foreground/70">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
