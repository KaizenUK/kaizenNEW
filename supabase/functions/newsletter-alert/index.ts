import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

Deno.serve(async (req) => {
  const payload = await req.json();
  const record = payload.record;

  const { data, error } = await resend.emails.send({
    from: "Kaizen Bot <system@kaizenweb.co.uk>",
    to: ["sales@kaizenweb.co.uk"],
    subject: "📢 New Newsletter Subscriber",
    html: `
      <h2>New Subscriber</h2>
      <p><strong>Email:</strong> ${record.email}</p>
      <p><strong>Marketing Consent:</strong> ${record.marketing_consent ? "✅ Yes" : "❌ No"}</p>
      <p><strong>Source Page:</strong> ${record.source_page || "Unknown"}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
    `,
  });

  if (error) return new Response(JSON.stringify(error), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
});