import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-md border border-border bg-background p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("mt-1 text-sm text-muted-foreground", className)} {...props} />;
}

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium", className)} {...props} />;
}

export function Alert({ className, tone = "danger", ...props }: ComponentProps<"p"> & { tone?: "danger" | "success" }) {
  return (
    <p
      role="alert"
      className={cn("rounded-md border px-3 py-2 text-sm", tone === "danger" ? "border-danger text-danger" : "border-success text-success", className)}
      {...props}
    />
  );
}
