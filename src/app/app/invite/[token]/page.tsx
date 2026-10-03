import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { acceptInvitation } from "../../actions";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <Card className="mx-auto max-w-md">
      <CardTitle>Rejoindre une organisation</CardTitle>
      <CardDescription>Vous avez été invité. L&apos;invitation doit correspondre à l&apos;adresse e-mail de votre compte.</CardDescription>
      <ActionForm action={acceptInvitation.bind(null, token)} className="mt-6">
        <SubmitButton>Accepter l&apos;invitation</SubmitButton>
      </ActionForm>
    </Card>
  );
}
