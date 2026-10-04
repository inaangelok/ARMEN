import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { useCustomers, useProfiles, useStations } from "@/hooks/data";
import { api } from "@/lib/api";
import type { Region, Role } from "@/lib/types";

const ROLE_VARIANT: Record<Role, "default" | "info" | "secondary"> = { admin: "default", technician: "info", owner: "secondary" };

export function Users() {
  const { t } = useTranslation();
  const profiles = useProfiles();
  const stations = useStations();
  const customers = useCustomers();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", role: "owner" as Role });
  const list = (profiles.data ?? []).filter((p) => (!role || p.role === role) && (!q || `${p.full_name} ${p.email}`.toLowerCase().includes(q.toLowerCase())));
  const stationsFor = (id: string, r: Role) =>
    r === "technician"
      ? (stations.data ?? []).filter((s) => s.technician_id === id).length
      : r === "owner"
        ? (stations.data ?? []).filter((s) => customers.data?.find((c) => c.id === s.customer_id)?.owner_id === id).length
        : stations.data?.length ?? 0;
  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.inviteUser(form);
      toast.success(t("users.invited", { email: form.email }));
      setInviting(false);
      setForm({ email: "", full_name: "", role: "owner" });
    } catch (err) {
      toast.error((err as Error).message === "invite_function_missing" ? t("users.inviteMissing") : (err as Error).message);
    }
  };
  return (
    <div>
      <PageHeader
        title={t("users.title")}
        subtitle={t("users.subtitle")}
        actions={
          <Button onClick={() => setInviting(true)}>
            <UserPlus /> {t("users.invite")}
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("users.search")} className="pl-9" aria-label={t("users.search")} />
        </div>
        <NativeSelect value={role} onChange={(e) => setRole(e.target.value as Role | "")} className="w-44" aria-label={t("users.role")}>
          <option value="">{t("users.allRoles")}</option>
          {(["owner", "technician", "admin"] as const).map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Card className="overflow-hidden">
        {profiles.isLoading ? (
          <Skeleton className="h-96" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">{t("users.name")}</th>
                  <th className="px-3 py-2.5">{t("users.role")}</th>
                  <th className="px-3 py-2.5">{t("fleet.region")}</th>
                  <th className="px-3 py-2.5 text-right">{t("fleet.stations")}</th>
                  <th className="px-3 py-2.5">{t("settings.language")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold">{p.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Badge variant={ROLE_VARIANT[p.role]}>{t(`roles.${p.role}`)}</Badge>
                        <NativeSelect
                          value={p.role}
                          onChange={async (e) => {
                            await api.updateProfile(p.id, { role: e.target.value as Role });
                            toast.success(t("users.updated"));
                          }}
                          className="w-36"
                          aria-label={`${t("users.role")} ${p.full_name}`}
                        >
                          {(["owner", "technician", "admin"] as const).map((r) => (
                            <option key={r} value={r}>
                              {t(`roles.${r}`)}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {p.role === "technician" ? (
                        <NativeSelect value={p.region ?? ""} onChange={(e) => api.updateProfile(p.id, { region: (e.target.value || null) as Region | null })} className="w-36" aria-label={t("fleet.region")}>
                          <option value="">—</option>
                          <option value="Aragatsotn">{t("region.Aragatsotn")}</option>
                          <option value="Yerevan">{t("region.Yerevan")}</option>
                        </NativeSelect>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right">{stationsFor(p.id, p.role)}</td>
                    <td className="px-3 py-2.5 uppercase">{p.language}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Dialog open={inviting} onOpenChange={setInviting}>
        <DialogContent closeLabel={t("common.close")}>
          <form onSubmit={invite} className="space-y-3">
            <DialogHeader>
              <DialogTitle>{t("users.invite")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">{t("users.name")}</Label>
              <Input id="inv-name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email</Label>
              <Input id="inv-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-role">{t("users.role")}</Label>
              <NativeSelect id="inv-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {(["owner", "technician", "admin"] as const).map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviting(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit">{t("users.sendInvite")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
