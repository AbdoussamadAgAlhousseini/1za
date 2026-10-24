import { beforeAll, describe, expect, it } from "vitest";
import { createAthlete, createStaff, dbTestsEnabled, randomMatricule, shiftDate, today, type Client } from "./helpers";

describe.skipIf(!dbTestsEnabled)("sportifs et abonnements", () => {
  let admin: Client;
  let t: string;

  beforeAll(async () => {
    admin = (await createStaff("admin")).client;
    t = await today(admin);
  });

  describe("matricules", () => {
    it("normalise la saisie (espaces, tirets, minuscules)", async () => {
      const raw = randomMatricule();
      const messy = ` ${raw.slice(0, 2).toLowerCase()}-${raw.slice(2, 4)} ${raw.slice(4)} `;
      const { data: id, error } = await admin.rpc("admin_create_athlete", { p_matricule: messy });
      expect(error).toBeNull();
      const { data } = await admin.from("athletes").select("matricule").eq("id", id!).single();
      expect(data?.matricule).toBe(raw);
    });

    it.each(["A123456", "ABC1234", "AB1234", "AB123456", "12ABCDE", ""])("rejette le format %j", async (value) => {
      const { error } = await admin.rpc("admin_create_athlete", { p_matricule: value });
      expect(error?.message).toBe("ERR_MATRICULE_FORMAT");
    });

    it("refuse un doublon sans rien créer", async () => {
      const m = randomMatricule();
      await admin.rpc("admin_create_athlete", { p_matricule: m });
      const { error } = await admin.rpc("admin_create_athlete", { p_matricule: m.toLowerCase() });
      expect(error?.message).toBe("ERR_MATRICULE_DUPLICATE");
      const { count } = await admin.from("athletes").select("id", { count: "exact", head: true }).eq("matricule", m);
      expect(count).toBe(1);
    });

    it("refuse une date d'inscription future", async () => {
      const { error } = await admin.rpc("admin_create_athlete", {
        p_matricule: randomMatricule(),
        p_registered_on: shiftDate(t, 1),
      });
      expect(error?.message).toBe("ERR_DATE_FUTURE");
    });

    it("journalise la création sans stocker le matricule dans le journal", async () => {
      const m = randomMatricule();
      const { data: id } = await admin.rpc("admin_create_athlete", { p_matricule: m });
      const { data: logs } = await admin.from("audit_logs").select("*").eq("entity_id", id!);
      expect(logs).toHaveLength(1);
      expect(logs![0]!.action).toBe("athlete.created");
      expect(JSON.stringify(logs![0]!.details)).not.toContain(m);
    });
  });

  describe("validité des abonnements", () => {
    it.each([
      { label: "actif (fin aujourd'hui incluse)", start: -10, end: 0, expected: "active" },
      { label: "actif (début aujourd'hui)", start: 0, end: 30, expected: "active" },
      { label: "expiré hier", start: -30, end: -1, expected: "expired" },
      { label: "pas encore valide", start: 1, end: 30, expected: "upcoming" },
    ])("statut $label", async ({ start, end, expected }) => {
      const { athleteId } = await createAthlete(admin, { start: shiftDate(t, start), end: shiftDate(t, end) });
      const { data } = await admin.from("athlete_overview").select("status").eq("id", athleteId).single();
      expect(data?.status).toBe(expected);
    });

    it("sportif sans abonnement", async () => {
      const { athleteId } = await createAthlete(admin);
      const { data } = await admin.from("athlete_overview").select("status").eq("id", athleteId).single();
      expect(data?.status).toBe("none");
    });

    it("calcule la date de fin à partir de la formule (fin incluse)", async () => {
      const { data: planId, error } = await admin.rpc("admin_save_plan", {
        p_id: null as unknown as string,
        p_name: `Mensuel test ${randomMatricule()}`,
        p_duration_days: 30,
        p_price: 10000,
        p_currency: "XOF",
        p_is_active: true,
      });
      expect(error).toBeNull();
      const { athleteId } = await createAthlete(admin);
      const { data: subId } = await admin.rpc("admin_create_subscription", {
        p_athlete_id: athleteId,
        p_plan_id: planId!,
        p_starts_on: t,
      });
      const { data } = await admin.from("subscriptions").select("starts_on, ends_on").eq("id", subId!).single();
      expect(data?.ends_on).toBe(shiftDate(t, 29));
    });

    it("refuse des dates incohérentes", async () => {
      const { athleteId } = await createAthlete(admin);
      const { error } = await admin.rpc("admin_create_subscription", {
        p_athlete_id: athleteId,
        p_plan_id: null as unknown as string,
        p_starts_on: t,
        p_ends_on: shiftDate(t, -1),
      });
      expect(error?.message).toBe("ERR_DATE_INVALID");
    });

    it("refuse deux abonnements qui se chevauchent", async () => {
      const { athleteId } = await createAthlete(admin, { start: t, end: shiftDate(t, 30) });
      const { error } = await admin.rpc("admin_create_subscription", {
        p_athlete_id: athleteId,
        p_plan_id: null as unknown as string,
        p_starts_on: shiftDate(t, 30),
        p_ends_on: shiftDate(t, 60),
      });
      expect(error?.message).toBe("ERR_SUBSCRIPTION_OVERLAP");
    });
  });

  describe("renouvellement", () => {
    it("crée un nouvel abonnement et conserve l'historique de l'ancien", async () => {
      const { athleteId, subscriptionId } = await createAthlete(admin, { start: shiftDate(t, -29), end: shiftDate(t, 2) });
      const { data: renewedId, error } = await admin.rpc("admin_create_subscription", {
        p_athlete_id: athleteId,
        p_plan_id: null as unknown as string,
        p_starts_on: shiftDate(t, 3),
        p_ends_on: shiftDate(t, 32),
        p_renewed_from_id: subscriptionId!,
        p_payment_amount: 15000,
        p_payment_method: "mobile_money",
        p_payment_reference: "REF-TEST",
      });
      expect(error).toBeNull();

      const { data: subs } = await admin
        .from("subscriptions")
        .select("id, starts_on, ends_on, renewed_from_id")
        .eq("athlete_id", athleteId)
        .order("starts_on");
      expect(subs).toHaveLength(2);
      expect(subs![0]!.ends_on).toBe(shiftDate(t, 2));
      expect(subs![1]!.renewed_from_id).toBe(subscriptionId);

      const { data: overview } = await admin
        .from("athlete_overview")
        .select("status, has_next_subscription, expiring_soon")
        .eq("id", athleteId)
        .single();
      expect(overview).toMatchObject({ status: "active", has_next_subscription: true, expiring_soon: false });

      const { data: payments } = await admin.from("payments").select("amount, currency, subscription_id").eq("athlete_id", athleteId);
      expect(payments).toEqual([{ amount: 15000, currency: "XOF", subscription_id: renewedId }]);

      const { data: log } = await admin.from("audit_logs").select("action").eq("entity_id", renewedId!);
      expect(log?.[0]?.action).toBe("subscription.renewed");
    });

    it("signale un abonnement bientôt expiré tant qu'il n'est pas renouvelé", async () => {
      const { athleteId } = await createAthlete(admin, { start: shiftDate(t, -20), end: shiftDate(t, 3) });
      const { data } = await admin.from("athlete_overview").select("expiring_soon").eq("id", athleteId).single();
      expect(data?.expiring_soon).toBe(true);
    });
  });

  describe("états administratifs", () => {
    it("suspend, réactive puis annule avec motif obligatoire", async () => {
      const { subscriptionId, athleteId } = await createAthlete(admin, { start: t, end: shiftDate(t, 10) });
      const noReason = await admin.rpc("admin_set_subscription_state", {
        p_subscription_id: subscriptionId!,
        p_state: "suspended",
        p_reason: "",
      });
      expect(noReason.error?.message).toBe("ERR_REASON_REQUIRED");

      expect(
        (await admin.rpc("admin_set_subscription_state", { p_subscription_id: subscriptionId!, p_state: "suspended", p_reason: "Contrôle médical" })).error,
      ).toBeNull();
      let { data } = await admin.from("athlete_overview").select("status").eq("id", athleteId).single();
      expect(data?.status).toBe("suspended");

      expect(
        (await admin.rpc("admin_set_subscription_state", { p_subscription_id: subscriptionId!, p_state: "active", p_reason: "Certificat reçu" })).error,
      ).toBeNull();
      expect(
        (await admin.rpc("admin_set_subscription_state", { p_subscription_id: subscriptionId!, p_state: "cancelled", p_reason: "Erreur de saisie" })).error,
      ).toBeNull();
      ({ data } = await admin.from("athlete_overview").select("status").eq("id", athleteId).single());
      expect(data?.status).toBe("none");

      const reopen = await admin.rpc("admin_set_subscription_state", {
        p_subscription_id: subscriptionId!,
        p_state: "active",
        p_reason: "Tentative de réouverture",
      });
      expect(reopen.error?.message).toBe("ERR_INVALID_STATE_TRANSITION");
    });

    it("un abonnement annulé libère la période pour une nouvelle saisie", async () => {
      const { subscriptionId, athleteId } = await createAthlete(admin, { start: t, end: shiftDate(t, 10) });
      await admin.rpc("admin_set_subscription_state", { p_subscription_id: subscriptionId!, p_state: "cancelled", p_reason: "Dates erronées" });
      const { error } = await admin.rpc("admin_create_subscription", {
        p_athlete_id: athleteId,
        p_plan_id: null as unknown as string,
        p_starts_on: t,
        p_ends_on: shiftDate(t, 20),
      });
      expect(error).toBeNull();
    });
  });

  describe("paiements", () => {
    it("enregistre puis annule un paiement avec motif", async () => {
      const { athleteId, subscriptionId } = await createAthlete(admin, { start: t, end: shiftDate(t, 10) });
      const { data: paymentId, error } = await admin.rpc("admin_record_payment", {
        p_athlete_id: athleteId,
        p_subscription_id: subscriptionId!,
        p_amount: 5000,
        p_currency: "xof",
        p_paid_on: t,
        p_method: "cash",
      });
      expect(error).toBeNull();
      const future = await admin.rpc("admin_record_payment", {
        p_athlete_id: athleteId,
        p_subscription_id: subscriptionId!,
        p_amount: 5000,
        p_currency: "XOF",
        p_paid_on: shiftDate(t, 1),
        p_method: "cash",
      });
      expect(future.error?.message).toBe("ERR_DATE_FUTURE");
      const negative = await admin.rpc("admin_record_payment", {
        p_athlete_id: athleteId,
        p_subscription_id: subscriptionId!,
        p_amount: -5,
        p_currency: "XOF",
        p_paid_on: t,
        p_method: "cash",
      });
      expect(negative.error?.message).toBe("ERR_INVALID_INPUT");

      expect((await admin.rpc("admin_cancel_payment", { p_payment_id: paymentId!, p_reason: "Doublon de saisie" })).error).toBeNull();
      const again = await admin.rpc("admin_cancel_payment", { p_payment_id: paymentId!, p_reason: "Doublon de saisie" });
      expect(again.error?.message).toBe("ERR_INVALID_STATE_TRANSITION");
    });
  });
});
