"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { AlertCircle, KeyRound, MoreHorizontal, Pencil, ShieldCheck, Trash2, UserCheck, UserPlus, UserX, Users } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { createAgent, deleteAgent, renameAgent, resetAgentPassword, setAgentActive } from "@/server/actions/staff";
import { ReasonDialog } from "@/components/subscriptions/reason-dialog";
import { safeAction } from "@/lib/safe-action";
import { formatPhone } from "@/lib/auth/identity";
import { formatDateTime, formatNumber } from "@/lib/domain/format";
import { generatePassword } from "@/lib/password";
import { cn } from "@/lib/cn";
import { PasswordField } from "./password-field";

export interface StaffRow {
  id: string;
  display_name: string;
  role: "admin" | "agent";
  is_active: boolean;
  login_phone: string | null;
  created_at: string;
  deactivated_at: string | null;
  deleted_at: string | null;
  entries_recorded: number;
  exits_recorded: number;
  last_activity_at: string | null;
}

type Dialogs =
  | { kind: "create" }
  | { kind: "reset"; agent: StaffRow }
  | { kind: "rename"; agent: StaffRow }
  | { kind: "toggle"; agent: StaffRow }
  | { kind: "delete"; agent: StaffRow }
  | null;

export function StaffManager({ rows, timezone }: { rows: StaffRow[]; timezone: string }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialogs>(null);
  const agents = rows.filter((r) => r.role === "agent" && !r.deleted_at);
  const deletedCount = rows.filter((r) => r.role === "agent" && r.deleted_at).length;
  const admins = rows.filter((r) => r.role === "admin");
  const close = () => setDialog(null);
  const done = () => {
    close();
    router.refresh();
  };

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button size="lg" onClick={() => setDialog({ kind: "create" })}>
          <UserPlus />
          Ajouter un agent
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader
          eyebrow="Agents de contrôle"
          title={`${agents.filter((a) => a.is_active).length} agent(s) actif(s)`}
          description="Activité sur les 30 derniers jours. Chaque agent dispose de son propre compte : aucun compte partagé."
        />
        {agents.length ? (
          <>
            <TableContainer className="hidden md:block">
              <Table>
                <THead>
                  <tr>
                    <Th>Agent</Th>
                    <Th>Téléphone de connexion</Th>
                    <Th>Accès</Th>
                    <Th className="text-right">Entrées</Th>
                    <Th className="text-right">Sorties</Th>
                    <Th>Dernière opération</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </THead>
                <TBody>
                  {agents.map((a) => (
                    <Tr key={a.id} className={cn(!a.is_active && "bg-surface-muted/70")}>
                      <Td className="font-semibold text-ink">{a.display_name}</Td>
                      <Td className="tabular whitespace-nowrap">{formatPhone(a.login_phone)}</Td>
                      <Td>
                        {a.is_active ? (
                          <Badge tone="success" icon={<UserCheck aria-hidden="true" />}>Actif</Badge>
                        ) : (
                          <Badge tone="neutral" icon={<UserX aria-hidden="true" />}>Désactivé</Badge>
                        )}
                      </Td>
                      <Td className="tabular text-right">{formatNumber(a.entries_recorded)}</Td>
                      <Td className="tabular text-right">{formatNumber(a.exits_recorded)}</Td>
                      <Td className="tabular whitespace-nowrap">{a.last_activity_at ? formatDateTime(a.last_activity_at, timezone) : <span className="text-ink-faint">—</span>}</Td>
                      <Td className="w-12 text-right">
                        <AgentMenu agent={a} onAction={setDialog} />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
            <ul className="divide-y divide-line md:hidden">
              {agents.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{a.display_name}</p>
                    <p className="tabular text-[13px] text-ink-muted">{formatPhone(a.login_phone)}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {formatNumber(a.entries_recorded)} entrées · {formatNumber(a.exits_recorded)} sorties (30 j)
                    </p>
                  </div>
                  {a.is_active ? <Badge tone="success">Actif</Badge> : <Badge tone="neutral">Désactivé</Badge>}
                  <AgentMenu agent={a} onAction={setDialog} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState
            icon={<Users />}
            title="Aucun agent"
            description="Créez un compte pour chaque agent de contrôle. Ils se connecteront avec leur numéro de téléphone."
            action={
              <Button onClick={() => setDialog({ kind: "create" })}>
                <UserPlus />
                Ajouter un agent
              </Button>
            }
          />
        )}
      </Card>

      {deletedCount > 0 ? (
        <p className="-mt-3 mb-6 text-xs text-ink-muted">
          {deletedCount} compte(s) d&apos;agent supprimé(s) : leurs opérations passées restent visibles dans la fréquentation et les rapports.
        </p>
      ) : null}

      <Card>
        <CardHeader eyebrow="Administration" title="Compte administrateur" description="Connexion par mot de passe seul (onglet « Administration »)." />
        <ul className="divide-y divide-line">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-5 py-3.5">
              <span className="grid size-9 place-items-center rounded-full bg-pitch-800 text-gold-300">
                <ShieldCheck className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{a.display_name}</p>
                <p className="text-xs text-ink-muted">Le mot de passe se modifie dans « Mon compte ».</p>
              </div>
              {a.is_active ? <Badge tone="success">Actif</Badge> : <Badge tone="neutral">Désactivé</Badge>}
            </li>
          ))}
        </ul>
      </Card>

      {dialog?.kind === "create" ? <CreateAgentDialog onClose={close} onDone={done} /> : null}
      {dialog?.kind === "reset" ? <ResetPasswordDialog agent={dialog.agent} onClose={close} onDone={done} /> : null}
      {dialog?.kind === "rename" ? <RenameDialog agent={dialog.agent} onClose={close} onDone={done} /> : null}
      {dialog?.kind === "toggle" ? <ToggleDialog agent={dialog.agent} onClose={close} onDone={done} /> : null}
      {dialog?.kind === "delete" ? (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && close()}
          title="Supprimer le compte ?"
          description={`Le compte de ${dialog.agent.display_name} (${formatPhone(dialog.agent.login_phone)}) sera supprimé définitivement : plus aucune connexion possible et le numéro pourra être réutilisé. Ses entrées et sorties passées restent dans l'historique, sous son nom.`}
          confirmLabel="Supprimer le compte"
          tone="danger"
          onSubmit={async (reason) => {
            const res = await deleteAgent({ userId: dialog.agent.id, reason });
            if (res.ok) done();
            return res;
          }}
        />
      ) : null}
    </>
  );
}

function AgentMenu({ agent, onAction }: { agent: StaffRow; onAction: (d: Dialogs) => void }) {
  const item = "flex cursor-pointer select-none items-center gap-2.5 rounded-[5px] px-2.5 py-2 text-sm outline-none [&_svg]:size-4";
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${agent.display_name}`}>
          <MoreHorizontal />
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={4} className="z-50 min-w-56 rounded-md border border-line bg-surface p-1 shadow-raised data-[state=open]:animate-fade-in">
          <Dropdown.Item className={cn(item, "text-ink data-[highlighted]:bg-surface-sunken")} onSelect={() => onAction({ kind: "reset", agent })}>
            <KeyRound />
            Réinitialiser le mot de passe
          </Dropdown.Item>
          <Dropdown.Item className={cn(item, "text-ink data-[highlighted]:bg-surface-sunken")} onSelect={() => onAction({ kind: "rename", agent })}>
            <Pencil />
            Modifier le nom
          </Dropdown.Item>
          <Dropdown.Separator className="my-1 h-px bg-line" />
          <Dropdown.Item
            className={cn(item, agent.is_active ? "text-danger-700 data-[highlighted]:bg-danger-50" : "text-success-700 data-[highlighted]:bg-success-50")}
            onSelect={() => onAction({ kind: "toggle", agent })}
          >
            {agent.is_active ? <UserX /> : <UserCheck />}
            {agent.is_active ? "Révoquer l'accès" : "Rétablir l'accès"}
          </Dropdown.Item>
          <Dropdown.Item className={cn(item, "text-danger-700 data-[highlighted]:bg-danger-50")} onSelect={() => onAction({ kind: "delete", agent })}>
            <Trash2 />
            Supprimer le compte
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

function CreateAgentDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Ajouter un agent" description="L'agent se connectera avec son numéro de téléphone et ce mot de passe.">
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await safeAction(() => createAgent({ displayName, phone, password }));
              if (!res.ok) {
                setErrors(res.fieldErrors ?? {});
                setFormError(res.fieldErrors ? null : res.message);
                return;
              }
              toast.success(res.message ?? "Agent créé.");
              onDone();
            });
          }}
        >
          {formError ? <InlineAlert tone="danger" icon={<AlertCircle />}>{formError}</InlineAlert> : null}
          <Field label="Nom de l'agent" error={errors.displayName} hint="Affiché dans les journaux et les statistiques de supervision.">
            {(p) => <Input {...p} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus maxLength={80} className="h-11" />}
          </Field>
          <Field label="Numéro de téléphone" error={errors.phone} hint="Indicatif +223 ajouté automatiquement pour un numéro à 8 chiffres.">
            {(p) => <Input {...p} type="tel" inputMode="tel" placeholder="76 12 34 56" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 tracking-[0.04em]" />}
          </Field>
          <PasswordField value={password} onChange={setPassword} error={errors.password} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={pending}>Annuler</Button>
            <Button type="submit" loading={pending}>{pending ? null : <UserPlus />}Créer le compte</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ agent, onClose, onDone }: { agent: StaffRow; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState(() => generatePassword());
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" title="Réinitialiser le mot de passe" description={`Nouveau mot de passe pour ${agent.display_name} (${formatPhone(agent.login_phone)}). L'ancien cessera de fonctionner.`}>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await safeAction(() => resetAgentPassword({ userId: agent.id, password }));
              if (!res.ok) {
                setError(res.fieldErrors?.password ?? res.message);
                return;
              }
              toast.success(res.message ?? "Mot de passe modifié.");
              onDone();
            });
          }}
        >
          <PasswordField value={password} onChange={setPassword} error={error} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={pending}>Annuler</Button>
            <Button type="submit" loading={pending}>{pending ? null : <KeyRound />}Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ agent, onClose, onDone }: { agent: StaffRow; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(agent.display_name);
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" title="Modifier le nom" description="Le changement est journalisé.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await safeAction(() => renameAgent({ userId: agent.id, displayName: name }));
              if (!res.ok) return setError(res.fieldErrors?.displayName ?? res.message);
              toast.success(res.message ?? "Nom modifié.");
              onDone();
            });
          }}
        >
          <Field label="Nom de l'agent" error={error}>
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus className="h-11" />}
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={pending}>Annuler</Button>
            <Button type="submit" loading={pending}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleDialog({ agent, onClose, onDone }: { agent: StaffRow; onClose: () => void; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={agent.is_active ? "Révoquer l'accès ?" : "Rétablir l'accès ?"}
      description={
        agent.is_active
          ? `${agent.display_name} ne pourra plus se connecter, avec effet immédiat. L'historique de ses opérations est conservé.`
          : `${agent.display_name} pourra de nouveau se connecter avec son numéro et son mot de passe.`
      }
      confirmLabel={agent.is_active ? "Révoquer l'accès" : "Rétablir l'accès"}
      tone={agent.is_active ? "danger" : "primary"}
      loading={pending}
      onConfirm={() =>
        start(async () => {
          const res = await safeAction(() => setAgentActive({ userId: agent.id, active: !agent.is_active }));
          if (!res.ok) {
            toast.error(res.message);
            return;
          }
          toast.success(res.message ?? "Accès mis à jour.");
          onDone();
        })
      }
    />
  );
}
