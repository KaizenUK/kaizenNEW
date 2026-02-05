import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const hubspotToken = Deno.env.get("HUBSPOT_ACCESS_TOKEN");

// 👇 REPLACE with your logo URL
const logoUrl = "https://kaizenweb.co.uk/assets/kaizenweb-logo-light-mode-260x50.png";

Deno.serve(async (req) => {
  const payload = await req.json();
  const record = payload.record;

  const marketingStatus = record.marketing_consent ? "✅ Subscribed" : "❌ No Consent";

  // 1. Email Logic
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background-color: #000000; padding: 30px; text-align: center; }
        .header img { max-height: 40px; }
        .content { padding: 40px; color: #333333; line-height: 1.6; }
        .h1 { font-size: 22px; font-weight: 700; margin-bottom: 20px; color: #111111; }
        .data-box { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .data-row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dashed #e5e7eb; padding-bottom: 10px; }
        .data-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .label { font-weight: 600; color: #666666; font-size: 14px; }
        .value { font-weight: 500; color: #111111; font-size: 14px; text-align: right; }
        .badge { display: inline-block; background-color: #eff6ff; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
        .footer { background-color: #f4f4f5; padding: 20px; text-align: center; font-size: 12px; color: #888888; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logoUrl}" alt="Kaizen Web" />
        </div>
        <div class="content">
          <div class="h1">📢 New Newsletter Subscriber</div>
          <p>Someone just joined the Kaizen Web mailing list.</p>
          
          <div class="data-box">
            <div class="data-row">
              <span class="label">Email Address</span>
              <span class="value">${record.email}</span>
            </div>
            <div class="data-row">
              <span class="label">Marketing Status</span>
              <span class="value">${marketingStatus}</span>
            </div>
            <div class="data-row">
              <span class="label">Source</span>
              <span class="value"><span class="badge">${record.source_page || "Unknown"}</span></span>
            </div>
          </div>

          <p>Added to HubSpot as <strong>Subscriber</strong>.</p>
        </div>
        <div class="footer">
          Automated Alert • Kaizen Web Bot
        </div>
      </div>
    </body>
    </html>
  `;

  const emailReq = resend.emails.send({
    from: "Kaizen Bot <system@kaizenweb.co.uk>",
    to: ["sales@kaizenweb.co.uk"],
    subject: "📢 New Subscriber: " + record.email,
    html: emailHtml,
  });

  // 2. HubSpot Logic
  const hubspotReq = fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${hubspotToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        email: record.email,
        lifecyclestage: "subscriber",
        kaizen_source: "Newsletter",
        marketing_consent: "true",
        consent_text: record.consent_text, // 👈 Explicit GDPR text
        source_page: record.source_page
      },
    }),
  });

  const [emailResult] = await Promise.all([emailReq, hubspotReq]);
  return new Response(JSON.stringify(emailResult), { status: 200 });
});