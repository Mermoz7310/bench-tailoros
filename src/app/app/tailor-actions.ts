"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrg } from "@/lib/auth";
import { friendlyDbError, type ActionState } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { customerSchema, orderSchema, parseMeasurements } from "@/lib/tailor";

const uuid = z.uuid();

export async function createCustomer(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { org } = await requireOrg(slug);
  const parsed = customerSchema.safeParse({ name: formData.get("name") ?? "", phone: formData.get("phone") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase.from("customers").insert({ org_id: org.id, ...parsed.data }).select("id").single();
  if (error) return { error: friendlyDbError(error) };
  await supabase.rpc("log_event", { p_org: org.id, p_action: "customer.created", p_target: data.id });
  revalidatePath(`/app/${slug}/customers`);
  return { success: `Client « ${parsed.data.name} » ajouté.` };
}

export async function deleteCustomer(slug: string, customerId: string, _prev: ActionState): Promise<ActionState> {
  const { org } = await requireOrg(slug, "members.manage");
  if (!uuid.safeParse(customerId).success) return { error: "Requête invalide." };

  const supabase = await createClient();
  const { error, count } = await supabase.from("customers").delete({ count: "exact" }).eq("id", customerId).eq("org_id", org.id);
  if (error) return { error: friendlyDbError(error) };
  if (!count) return { error: "Client introuvable." };
  await supabase.rpc("log_event", { p_org: org.id, p_action: "customer.deleted", p_target: customerId });
  redirect(`/app/${slug}/customers`);
}

export async function addMeasurement(slug: string, customerId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { org } = await requireOrg(slug);
  if (!uuid.safeParse(customerId).success) return { error: "Requête invalide." };
  const parsed = parseMeasurements(Object.fromEntries(formData));
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("measurements").insert({ org_id: org.id, customer_id: customerId, ...parsed.data });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/app/${slug}/customers/${customerId}`);
  return { success: "Mesures enregistrées." };
}

export async function createOrder(slug: string, customerId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { org } = await requireOrg(slug);
  if (!uuid.safeParse(customerId).success) return { error: "Requête invalide." };
  const parsed = orderSchema.safeParse({
    description: formData.get("description") ?? "",
    total: formData.get("total") ?? "",
    due_date: formData.get("due_date") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .insert({
      org_id: org.id,
      customer_id: customerId,
      description: parsed.data.description,
      total_xof: parsed.data.total,
      due_date: parsed.data.due_date,
    })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error) };
  await supabase.rpc("log_event", { p_org: org.id, p_action: "order.created", p_target: data.id });
  redirect(`/app/${slug}/orders/${data.id}`);
}

export async function recordPayment(slug: string, orderId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOrg(slug);
  if (!uuid.safeParse(orderId).success) return { error: "Requête invalide." };
  const amount = z
    .string()
    .transform((v) => Number(v.replace(/[\s  .]/g, "")))
    .pipe(z.number().int("Montant invalide.").positive("Le montant doit être supérieur à 0."))
    .safeParse(formData.get("amount") ?? "");
  if (!amount.success) return { error: amount.error.issues[0]?.message ?? "Montant invalide." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_payment", { p_order: orderId, p_amount: amount.data });
  if (error) {
    if (error.message?.includes("overpayment")) return { error: "Le montant dépasse le reste à payer." };
    if (error.code === "23514") return { error: "Paiement impossible sur une commande annulée." };
    return { error: friendlyDbError(error) };
  }
  revalidatePath(`/app/${slug}/orders/${orderId}`);
  return { success: "Paiement enregistré." };
}

export async function advanceOrder(slug: string, orderId: string, _prev: ActionState): Promise<ActionState> {
  await requireOrg(slug);
  if (!uuid.safeParse(orderId).success) return { error: "Requête invalide." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("advance_order_status", { p_order: orderId });
  if (error) return { error: error.code === "23514" ? "Cette commande est déjà terminée." : friendlyDbError(error) };
  revalidatePath(`/app/${slug}/orders/${orderId}`);
  return {};
}

export async function cancelOrder(slug: string, orderId: string, _prev: ActionState): Promise<ActionState> {
  await requireOrg(slug, "members.manage");
  if (!uuid.safeParse(orderId).success) return { error: "Requête invalide." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order: orderId });
  if (error) return { error: error.code === "23514" ? "Cette commande est déjà terminée." : friendlyDbError(error) };
  revalidatePath(`/app/${slug}/orders/${orderId}`);
  return {};
}
