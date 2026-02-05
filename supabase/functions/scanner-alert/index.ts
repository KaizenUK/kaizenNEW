import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const hubspotToken = Deno.env.get("HUBSPOT_ACCESS_TOKEN");

// 👇 REPLACE THIS with your actual logo URL (Right click logo on your site -> Copy Image Link)
const logoUrl = "https://kaizenweb.co.uk/assets/logo.png"; 

Deno.serve(async (req) => {
  const payload = await req.json();
  const record = payload.record;

  // 1. Fix URL & Prepare Data
  const url = record.website_url.startsWith('http') ? record.website_url : `https://${record.website_url}`;
  const score = record.performance_score || "Pending";
  
  // 2. The "Sexy" HTML Template
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background-color: #000000; padding: 30px; text-align: center; }
        .header img { max-height: 50px; }
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

  // 3. Send to Resend
  const emailReq = resend.emails.send({
    from: "Kai Bot <system@kaizenweb.co.uk>",
    to: ["sales@kaizenweb.co.uk"],
    subject: `🚀 Speed Scan: ${record.website_url}`,
    html: emailHtml,
  });

  // 4. Send to HubSpot
  const hubspotReq = fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${hubspotToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        email: record.email,
        website: url,
        lifecycle_stage: "lead", 
      },
    }),
  });

  // 5. Wait & Finish
  const [emailResult, hubspotResult] = await Promise.all([emailReq, hubspotReq]);

  if (!hubspotResult.ok) {
    const err = await hubspotResult.json();
    console.error("HubSpot Error:", err); 
  }

  return new Response(JSON.stringify(emailResult), { status: 200 });
});