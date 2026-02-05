import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const hubspotToken = Deno.env.get("HUBSPOT_ACCESS_TOKEN");

// 👇 REPLACE with your logo URL
const logoUrl = "https://kaizenweb.co.uk/assets/kaizenweb-logo-light-mode-260x50.png";

Deno.serve(async (req) => {
  const payload = await req.json();
  const record = payload.record;
    // --- 🛡️ SPAM FILTER START ---
  const emailDomain = record.email.split("@")[1].toLowerCase();
  
  // The "Trash List" - Domains that are 100% fake/disposable
  const trashDomains = [
    "yopmail.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", 
    "mailinator.com", "throwawaymail.com", "fake-email.com", "superrito.com",
    "sharklasers.com", "test.com", "example.com" 
  ];

  // The "Spam Pattern" Check - Blocks "test@test.com" or "a@a.com"
  const localPart = record.email.split("@")[0];
  if (
    trashDomains.includes(emailDomain) || 
    localPart.length < 2 ||       // e.g. "a@gmail.com"
    localPart === "test" ||       // e.g. "test@gmail.com"
    record.email === "test@test.com"
  ) {
    console.log(`🚫 Spam blocked: ${record.email}`);
    // We return 200 OK so the frontend/bot thinks it succeeded (Shadow Ban)
    // But we actually do nothing.
    return new Response(JSON.stringify({ message: "Blocked" }), { status: 200 });
  }
  // --- 🛡️ SPAM FILTER END ---

  const url = record.website_url.startsWith('http') ? record.website_url : `https://${record.website_url}`;
  const score = record.performance_score || "Pending";
  
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
        .h1 { font-size: 24px; font-weight: 700; margin-bottom: 20px; color: #111111; }
        .data-box { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .data-row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dashed #e5e7eb; padding-bottom: 10px; }
        .data-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .label { font-weight: 600; color: #666666; font-size: 14px; }
        .value { font-weight: 500; color: #111111; font-size: 14px; text-align: right; }
        .btn { display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 10px; }
        .footer { background-color: #f4f4f5; padding: 20px; text-align: center; font-size: 12px; color: #888888; }
        .score-badge { display: inline-block; background-color: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 99px; font-weight: bold; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logoUrl}" alt="Kaizen Web" />
        </div>
        <div class="content">
          <div class="h1">🚀 Speed Scan Request</div>
          <p>You have a new high-intent lead. A user just scanned their website performance.</p>
          
          <div class="data-box">
            <div class="data-row">
              <span class="label">Website</span>
              <span class="value"><a href="${url}" style="color: #2563eb; text-decoration: none;">${record.website_url}</a></span>
            </div>
            <div class="data-row">
              <span class="label">Lead Email</span>
              <span class="value">${record.email}</span>
            </div>
            <div class="data-row">
              <span class="label">Current Score</span>
              <span class="value"><span class="score-badge">${score}</span></span>
            </div>
          </div>

          <p>This lead has been automatically synced to HubSpot.</p>
          <center>
            <a href="https://app.hubspot.com/contacts" class="btn">View in HubSpot</a>
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
    subject: `🚀 Speed Scan: ${record.website_url}`,
    html: emailHtml,
  });

  // 2. HubSpot Logic
  const hubspotProps: any = {
    email: record.email,
    website: url,           // Standard HubSpot field
    tested_url: url,        // Custom field (specific to this scan)
    lifecyclestage: "lead",
    kaizen_source: "Speed Scanner"
  };

  if (record.performance_score) {
    hubspotProps.speed_score = record.performance_score;
  }

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