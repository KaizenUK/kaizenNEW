import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

Deno.serve(async (req) => {
  const payload = await req.json();
  const record = payload.record;

  const { data, error } = await resend.emails.send({
    from: "Kaizen Bot <system@kaizenweb.co.uk>",
    to: ["sales@kaizenweb.co.uk"],
    reply_to: record.email, // 👈 Ensures 'Reply' goes to the customer
    subject: `📩 Contact: ${record.name}`,
    html: `
      <h2>New Enquiry from ${record.name}</h2>
      <p><strong>Email:</strong> ${record.email}</p>
      <p><strong>Source:</strong> ${record.source_page || "Contact Page"}</p>
      <hr />
      <h3>Message:</h3>
      <p style="background: #f4f4f5; padding: 15px; border-radius: 5px;">${record.message}</p>
    `,
  });

  if (error) return new Response(JSON.stringify(error), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
});