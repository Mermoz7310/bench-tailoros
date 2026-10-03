import { describe, expect, it } from "vitest";
import { escapeHtml, invitationEmail } from "@/lib/email-templates";
import { friendlyDbError } from "@/lib/errors";

describe("e-mails", () => {
  it("échappe le HTML pour empêcher l'injection dans les e-mails", () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe("&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");
  });

  it("l'invitation contient le lien et n'injecte pas le nom brut", () => {
    const mail = invitationEmail({ orgName: "<b>Org</b>", inviterName: "Awa", link: "https://app.test/app/invite/abc" });
    expect(mail.html).toContain("&lt;b&gt;Org&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Org</b>");
    expect(mail.text).toContain("https://app.test/app/invite/abc");
  });
});

describe("messages d'erreur", () => {
  it("ne révèle jamais le message technique", () => {
    expect(friendlyDbError({ code: "XX000", message: "relation secret_table" })).not.toContain("secret_table");
  });
  it("traduit un refus de droits", () => {
    expect(friendlyDbError({ code: "42501" })).toMatch(/droits/);
  });
});
