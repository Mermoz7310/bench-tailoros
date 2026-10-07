import { afterAll, describe, expect, it } from "vitest";
import { addMember, asUser, cleanup, createOrg, createUser, pool, type TestUser } from "./helpers";

afterAll(async () => {
  await cleanup();
  await pool.end();
});

const DENIED = { code: "42501" };

async function setup() {
  const owner = await createUser("tailor");
  const org = await createOrg(owner, "Atelier");
  const { rows } = await pool.query<{ id: string }>(
    "insert into public.customers (org_id, name, phone) values ($1, 'Aminata', '771234567') returning id",
    [org.id],
  );
  const customerId = rows[0]!.id;
  const order = await pool.query<{ id: string }>(
    "insert into public.orders (org_id, customer_id, description, total_xof, due_date) values ($1, $2, 'Boubou', 10000, current_date + 7) returning id",
    [org.id, customerId],
  );
  return { owner, org, customerId, orderId: order.rows[0]!.id };
}

const balance = async (user: TestUser, orderId: string) =>
  asUser(user, async (q) =>
    (await q<{ paid_xof: string; balance_xof: string; status: string }>("select paid_xof, balance_xof, status from public.order_balances where id = $1", [orderId])).rows[0],
  );

describe("isolation des données de l'atelier", () => {
  it("un autre atelier ne voit ni clients, ni mesures, ni commandes, ni paiements, ni soldes", async () => {
    const { orderId, customerId, owner } = await setup();
    await asUser(owner, (q) => q("select public.add_payment($1, 2000)", [orderId]), true);
    await pool.query("insert into public.measurements (org_id, customer_id, chest) select org_id, id, 90 from public.customers where id = $1", [customerId]);

    const stranger = await createUser("stranger");
    await createOrg(stranger, "Autre atelier");
    const seen = await asUser(stranger, async (q) => ({
      customers: (await q("select 1 from public.customers where id = $1", [customerId])).rowCount,
      measurements: (await q("select 1 from public.measurements where customer_id = $1", [customerId])).rowCount,
      orders: (await q("select 1 from public.orders where id = $1", [orderId])).rowCount,
      payments: (await q("select 1 from public.payments where order_id = $1", [orderId])).rowCount,
      balances: (await q("select 1 from public.order_balances where id = $1", [orderId])).rowCount,
    }));
    expect(seen).toEqual({ customers: 0, measurements: 0, orders: 0, payments: 0, balances: 0 });
  });

  it("impossible de créer un client dans un autre atelier", async () => {
    const { org } = await setup();
    const stranger = await createUser("intruder");
    await expect(
      asUser(stranger, (q) => q("insert into public.customers (org_id, name) values ($1, 'Pirate')", [org.id])),
    ).rejects.toMatchObject(DENIED);
  });

  it("impossible de rattacher une commande au client d'un autre atelier (clé composite)", async () => {
    const victim = await setup();
    const attacker = await createUser("attacker");
    const attackerOrg = await createOrg(attacker, "Atelier pirate");
    await expect(
      asUser(attacker, (q) =>
        q("insert into public.orders (org_id, customer_id, description, total_xof, due_date) values ($1, $2, 'x', 1, current_date)", [attackerOrg.id, victim.customerId]),
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("impossible de payer ou faire avancer la commande d'un autre atelier", async () => {
    const { orderId } = await setup();
    const stranger = await createUser("payer");
    await expect(asUser(stranger, (q) => q("select public.add_payment($1, 100)", [orderId]))).rejects.toMatchObject({ code: "P0002" });
    await expect(asUser(stranger, (q) => q("select public.advance_order_status($1)", [orderId]))).rejects.toMatchObject({ code: "P0002" });
  });
});

describe("règles métier", () => {
  it("le total des paiements ne peut pas dépasser le prix", async () => {
    const { owner, orderId } = await setup();
    await asUser(owner, (q) => q("select public.add_payment($1, 6000)", [orderId]), true);
    await expect(asUser(owner, (q) => q("select public.add_payment($1, 4001)", [orderId]))).rejects.toMatchObject({ code: "23514" });
    await asUser(owner, (q) => q("select public.add_payment($1, 4000)", [orderId]), true);
    expect(await balance(owner, orderId)).toMatchObject({ paid_xof: "10000", balance_xof: "0" });
  });

  it("refuse un paiement nul, négatif, ou sur une commande annulée", async () => {
    const { owner, orderId } = await setup();
    await expect(asUser(owner, (q) => q("select public.add_payment($1, 0)", [orderId]))).rejects.toMatchObject({ code: "22023" });
    await expect(asUser(owner, (q) => q("select public.add_payment($1, -5)", [orderId]))).rejects.toMatchObject({ code: "22023" });
    await asUser(owner, (q) => q("select public.cancel_order($1)", [orderId]), true);
    await expect(asUser(owner, (q) => q("select public.add_payment($1, 100)", [orderId]))).rejects.toMatchObject({ code: "23514" });
  });

  it("deux paiements simultanés ne peuvent pas dépasser le prix", async () => {
    const { owner, orderId } = await setup();
    const results = await Promise.allSettled([
      asUser(owner, (q) => q("select public.add_payment($1, 7000)", [orderId]), true),
      asUser(owner, (q) => q("select public.add_payment($1, 7000)", [orderId]), true),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await balance(owner, orderId)).toMatchObject({ paid_xof: "7000" });
  });

  it("impossible d'insérer un paiement directement (contournement de la vérification)", async () => {
    const { owner, org, orderId } = await setup();
    await expect(
      asUser(owner, (q) => q("insert into public.payments (org_id, order_id, amount_xof) values ($1, $2, 999999)", [org.id, orderId])),
    ).rejects.toMatchObject(DENIED);
  });

  it("le statut avance d'un pas à la fois et s'arrête à livrée", async () => {
    const { owner, orderId } = await setup();
    const steps: string[] = [];
    for (let i = 0; i < 3; i++) {
      steps.push(await asUser(owner, async (q) => (await q<{ s: string }>("select public.advance_order_status($1) as s", [orderId])).rows[0]!.s, true));
    }
    expect(steps).toEqual(["in_progress", "ready", "delivered"]);
    await expect(asUser(owner, (q) => q("select public.advance_order_status($1)", [orderId]))).rejects.toMatchObject({ code: "23514" });
    await expect(asUser(owner, (q) => q("select public.cancel_order($1)", [orderId]))).rejects.toMatchObject({ code: "23514" });
  });

  it("personne ne peut modifier le statut directement, ni créer une commande déjà livrée", async () => {
    const { owner, org, orderId, customerId } = await setup();
    await expect(asUser(owner, (q) => q("update public.orders set status = 'delivered' where id = $1", [orderId]))).rejects.toMatchObject(DENIED);
    await expect(
      asUser(owner, (q) =>
        q("insert into public.orders (org_id, customer_id, description, total_xof, due_date, status) values ($1, $2, 'x', 1, current_date, 'delivered')", [org.id, customerId]),
      ),
    ).rejects.toMatchObject(DENIED);
  });

  it("seul un admin peut annuler une commande ou supprimer un client", async () => {
    const { org, orderId, customerId } = await setup();
    const member = await createUser("member");
    await addMember(org.id, member, "member");
    await expect(asUser(member, (q) => q("select public.cancel_order($1)", [orderId]))).rejects.toMatchObject(DENIED);
    const deleted = await asUser(member, async (q) => (await q("delete from public.customers where id = $1", [customerId])).rowCount);
    expect(deleted).toBe(0);
  });

  it("un client avec des commandes ne peut pas être supprimé (historique protégé)", async () => {
    const { owner, customerId } = await setup();
    await expect(asUser(owner, (q) => q("delete from public.customers where id = $1", [customerId]))).rejects.toMatchObject({ code: "23503" });
  });

  it("une commande est en retard seulement si la date est passée et qu'elle n'est ni livrée ni annulée", async () => {
    const { owner, org, customerId } = await setup();
    const mk = async (days: number) =>
      (await pool.query<{ id: string }>(
        "insert into public.orders (org_id, customer_id, description, total_xof, due_date) values ($1, $2, 'x', 100, current_date + $3::int) returning id",
        [org.id, customerId, days],
      )).rows[0]!.id;
    const late = await mk(-1);
    const today = await mk(0);
    const lateCancelled = await mk(-3);
    await asUser(owner, (q) => q("select public.cancel_order($1)", [lateCancelled]), true);

    const flags = await asUser(owner, async (q) =>
      Object.fromEntries((await q<{ id: string; is_late: boolean }>("select id, is_late from public.order_balances where id = any($1::uuid[])", [[late, today, lateCancelled]])).rows.map((r) => [r.id, r.is_late])),
    );
    expect(flags).toEqual({ [late]: true, [today]: false, [lateCancelled]: false });
  });

  it("les mesures doivent être entre 1 et 300 cm et au moins une renseignée", async () => {
    const { owner, org, customerId } = await setup();
    const insert = (cols: string) =>
      asUser(owner, (q) => q(`insert into public.measurements (org_id, customer_id${cols ? ", " + cols.split("=")[0] : ""}) values ($1, $2${cols ? ", " + cols.split("=")[1] : ""})`, [org.id, customerId]));
    await expect(insert("")).rejects.toMatchObject({ code: "23514" });
    await expect(insert("waist=900")).rejects.toMatchObject({ code: "23514" });
    await expect(insert("waist=74.5")).resolves.toBeDefined();
  });

  it("chaque action importante est journalisée avec son auteur", async () => {
    const { owner, org, orderId } = await setup();
    await asUser(owner, (q) => q("select public.add_payment($1, 1000)", [orderId]), true);
    await asUser(owner, (q) => q("select public.advance_order_status($1)", [orderId]), true);
    const { rows } = await pool.query("select action, actor_id from public.audit_logs where org_id = $1 and target = $2 order by id", [org.id, orderId]);
    expect(rows).toEqual([
      { action: "payment.recorded", actor_id: owner.id },
      { action: "order.status_changed", actor_id: owner.id },
    ]);
  });
});

describe("suppression d'un atelier (droit à l'effacement)", () => {
  it("supprimer l'organisation efface clients, mesures, commandes et paiements", async () => {
    const { owner, org, orderId, customerId } = await setup();
    await asUser(owner, (q) => q("select public.add_payment($1, 500)", [orderId]), true);
    await pool.query("insert into public.measurements (org_id, customer_id, chest) values ($1, $2, 90)", [org.id, customerId]);
    await pool.query("delete from public.organizations where id = $1", [org.id]);
    const left = await pool.query(
      `select (select count(*) from public.customers where org_id = $1)
            + (select count(*) from public.measurements where org_id = $1)
            + (select count(*) from public.orders where org_id = $1)
            + (select count(*) from public.payments where org_id = $1) as n`,
      [org.id],
    );
    expect(Number(left.rows[0].n)).toBe(0);
  });
});
