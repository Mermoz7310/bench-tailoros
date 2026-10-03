import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { createOrganization } from "../actions";

export const metadata: Metadata = { title: "Créer une organisation" };

export default function OnboardingPage() {
  return (
    <Card className="mx-auto max-w-md">
      <CardTitle>Créer votre organisation</CardTitle>
      <CardDescription>Votre entreprise ou votre équipe. Vous pourrez inviter des collègues ensuite.</CardDescription>
      <ActionForm action={createOrganization} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nom de l&apos;organisation</Label>
          <Input id="name" name="name" required minLength={2} maxLength={80} placeholder="Atelier Fatou" />
        </div>
        <SubmitButton>Créer</SubmitButton>
      </ActionForm>
    </Card>
  );
}
