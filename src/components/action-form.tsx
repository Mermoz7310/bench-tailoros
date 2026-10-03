"use client";

import { useActionState, type ReactNode } from "react";
import { FormMessage } from "@/components/form";
import type { ActionState } from "@/lib/errors";

/** Formulaire branché sur une Server Action qui renvoie { error | success }. */
export function ActionForm({
  action,
  children,
  className,
  testId,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className={className} data-testid={testId}>
      {children}
      <div className="mt-2 basis-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
