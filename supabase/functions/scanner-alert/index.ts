import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

Deno.serve(async (req) => {
  const payload = await req.json();
  const record = payload.record;

  const { data, error } = await resend.emails.send({
    from: "Kaizen Bot <system@kaizenweb.co.uk>",
    to: ["sales@kaizenweb.co.uk"],
    subject: `🚀 Speed Scan: ${record.website_url}`,
    html: `
      <h2>New Speed Scan Submitted</h2>
      <p><strong>Site:</strong> <a href="${record.website_url}">${record.website_url}</a></p>
      <p><strong>Lead Email:</strong> ${record.email}</p>
      <p><strong>Score:</strong> ${record.performance_score || "Pending..."}</p>
      <hr />
      <p><em>This is a high-intent lead. Follow up immediately.</em></p>
    `,
  });

  if (error) return new Response(JSON.stringify(error), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
});