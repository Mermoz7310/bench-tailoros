import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { requireOrg } from "@/lib/auth";
import { renameOrganization } from "../../actions";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org } = await requireOrg(slug, "org.update");
  return (
    <Card className="max-w-lg">
      <CardTitle>Paramètres</CardTitle>
      <ActionForm action={renameOrganization.bind(null, org.slug)} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nom</Label>
          <Input id="name" name="name" defaultValue={org.name} required minLength={2} maxLength={80} />
        </div>
        <SubmitButton>Enregistrer</SubmitButton>
      </ActionForm>
    </Card>
  );
}
