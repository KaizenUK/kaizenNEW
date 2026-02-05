import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const hubspotToken = Deno.env.get("HUBSPOT_ACCESS_TOKEN");

// 👇 REPLACE with your logo URL
const logoUrl = "https://kaizenweb.co.uk/assets/kaizenweb-logo-light-mode-260x50.png";

Deno.serve(async (req) => {
  const payload = await req.json();
  const record = payload.record;

  const nameParts = (record.name || "").split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");

  // Check consent (default to false if missing)
  const hasConsented = record.marketing_consent || false;
  const consentStatus = hasConsented ? "✅ Opted-in" : "❌ No Marketing";

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
        .message-box { background-color: #f3f4f6; padding: 15px; border-left: 4px solid #000000; border-radius: 4px; font-style: italic; color: #4b5563; margin-top: 20px; }
        .btn { display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 20px; }
        .footer { background-color: #f4f4f5; padding: 20px; text-align: center; font-size: 12px; color: #888888; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logoUrl}" alt="Kaizen Web" />
        </div>
        <div class="content">
          <div class="h1">📩 New Enquiry</div>
          <p><strong>${firstName} ${lastName}</strong> has sent a message via the website.</p>
          
          <div class="data-box">
            <div class="data-row">
              <span class="label">Name</span>
              <span class="value">${firstName} ${lastName}</span>
            </div>
            <div class="data-row">
              <span class="label">Email</span>
              <span class="value"><a href="mailto:${record.email}" style="color: #2563eb;">${record.email}</a></span>
            </div>
            <div class="data-row">
              <span class="label">Phone</span>
              <span class="value">${record.phone || "Not provided"}</span>
            </div>
            <div class="data-row">
              <span class="label">Marketing</span>
              <span class="value">${consentStatus}</span>
            </div>
          </div>

          <div class="message-box">
            "${record.message}"
          </div>

          <center>
            <a href="mailto:${record.email}" class="btn">Reply to Lead</a>
          </center>
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
    reply_to: record.email,
    subject: `📩 Contact: ${firstName} ${lastName}`,
    html: emailHtml,
  });

  // 2. HubSpot Logic
  const hubspotProps: any = {
    email: record.email,
    firstname: firstName,
    lastname: lastName,
    lifecyclestage: "lead",
    kaizen_source: "Contact Form",
    source_page: record.source_page,
    contact_message: record.message,
    marketing_consent: hasConsented.toString() // Sends "true" or "false"
  };

  if (record.phone) hubspotProps.phone = record.phone;
  if (record.website) hubspotProps.website = record.website;

  const hubspotReq = fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${hubspotToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: hubspotProps }),
  });

  const [emailResult] = await Promise.all([emailReq, hubspotReq]);
  return new Response(JSON.stringify(emailResult), { status: 200 });
});