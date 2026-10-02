export type ScannerFinding = { id: string; title: string; savings: string };

const findings: Record<string, [string, string]> = {
  "render-blocking-resources": [
    "Files hold up the first view",
    "Check which files must load before people can see the page.",
  ],
  "unused-javascript": [
    "Code loads without being used",
    "Ask whether unused features can be removed from this page.",
  ],
  "unused-css-rules": [
    "Unused styles still load",
    "Check whether this page needs all of its style files.",
  ],
  "offscreen-images": [
    "Images load before they are needed",
    "Load images further down the page as people reach them.",
  ],
  "unminified-javascript": [
    "Code files could be smaller",
    "Ask your web designer to reduce the size of these files.",
  ],
  "unminified-css": [
    "Style files could be smaller",
    "Ask your web designer to reduce the size of these files.",
  ],
  "uses-optimized-images": [
    "Image files could be smaller",
    "Check image sizes while keeping the pictures clear.",
  ],
  "uses-webp-images": [
    "Images could use smaller file types",
    "Compare smaller image files without losing visible detail.",
  ],
  "uses-text-compression": [
    "Text files could be smaller",
    "Ask your host to check how these files are sent.",
  ],
  "uses-responsive-images": [
    "Images are larger than the space they fill",
    "Send a smaller picture to smaller screens.",
  ],
  "efficient-animated-content": [
    "Moving images use large files",
    "Check whether a smaller video can show the same thing.",
  ],
  "duplicated-javascript": [
    "The same code loads more than once",
    "Check which copies can be removed safely.",
  ],
  "legacy-javascript": [
    "Extra code supports older browsers",
    "Check which browser versions the site still needs to support.",
  ],
  "total-byte-weight": [
    "The page downloads a lot of data",
    "Start by checking the largest files.",
  ],
  "dom-size": [
    "The page has many parts to load",
    "Check whether the page can be simpler without losing useful content.",
  ],
  "critical-request-chains": [
    "Some files wait for other files",
    "Check which waits delay the first view of the page.",
  ],
  redirects: [
    "Extra steps delay the page",
    "Use the final page address in links where possible.",
  ],
  "uses-rel-preconnect": [
    "Connections to other sites take time",
    "Check which outside services the page needs first.",
  ],
  "server-response-time": [
    "The site takes time to reply",
    "Ask your host to check the wait before the page starts arriving.",
  ],
  "mainthread-work-breakdown": [
    "The browser has a lot to do",
    "Check which features can wait until the page is ready.",
  ],
  "bootup-time": [
    "Code takes time to start",
    "Review features that run as soon as the page opens.",
  ],
  "font-display": [
    "Text waits for its font",
    "Let the words appear while the chosen font loads.",
  ],
  "third-party-summary": [
    "Outside services add work",
    "Review whether each chat box, advert or other service is needed.",
  ],
  "image-delivery-insight": [
    "Images could load with less data",
    "Check picture sizes and file types, while keeping them clear.",
  ],
  "cache-insight": [
    "Repeat visits could reuse more files",
    "Ask your host which unchanged files a browser can keep.",
  ],
};
findings["render-blocking-insight"] = findings["render-blocking-resources"];
findings["legacy-javascript-insight"] = findings["legacy-javascript"];
findings["network-dependency-tree-insight"] =
  findings["critical-request-chains"];
findings["font-display-insight"] = findings["font-display"];
findings["dom-size-insight"] = findings["dom-size"];
findings["third-parties-insight"] = findings["third-party-summary"];

export const scannerFindingIds = Object.keys(findings);
export function describeScannerFinding(id: string) {
  return (
    findings[id] || [
      "A further check is needed",
      "Ask your web designer to review this finding in Google's report.",
    ]
  );
}

export async function createScannerPdf(report: {
  url: string;
  testedAt: string;
  score: number;
  screenshot: string;
  metrics: {
    lcp: string;
    tbt: string;
    cls: string;
    fcp: string;
    si: string;
    tti: string;
    opportunities: ScannerFinding[];
  };
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF("p", "mm", "a4");
  const ink = "#0f172a",
    muted = "#475569",
    blue = "#175cd3";
  const normalise = (text: string) => text.replace(/[\u00a0\u202f]/g, " ");
  let y = 0;
  const header = (title: string) => {
    doc.setFillColor(ink).rect(0, 0, 210, 30, "F");
    doc.setFont("helvetica", "bold").setFontSize(16).setTextColor("#ffffff");
    doc.text(title, 18, 19);
    doc.setFontSize(9).text("KAIZEN", 192, 19, { align: "right" });
    y = 43;
  };
  const ensureSpace = (height: number) => {
    if (y + height > 271) {
      doc.addPage();
      header("Your website speed report");
    }
  };
  const text = (
    value: string,
    size = 10,
    colour = muted,
    bold = false,
    width = 174,
  ) => {
    doc
      .setFont("helvetica", bold ? "bold" : "normal")
      .setFontSize(size)
      .setTextColor(colour);
    const lines = doc.splitTextToSize(normalise(value), width);
    const height = lines.length * size * 0.42;
    ensureSpace(height + 4);
    doc
      .setFont("helvetica", bold ? "bold" : "normal")
      .setFontSize(size)
      .setTextColor(colour);
    doc.text(lines, 18, y);
    y += height + 4;
  };
  const link = (label: string, url: string) => {
    ensureSpace(12);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(blue);
    doc.textWithLink(label, 18, y, { url });
    y += 11;
  };
  header("Your website speed report");
  text(report.url, 13, ink, true);
  text(
    `Test run: ${new Date(report.testedAt).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "long", timeStyle: "short" })} (UK time)`,
    9,
  );
  text("One page, tested as a phone visit", 20, ink, true);
  text(
    "Google runs this test using a simulated phone and connection. Real visits can differ.",
  );
  const band =
    report.score >= 90
      ? "Good"
      : report.score >= 50
        ? "Needs improvement"
        : "Poor";
  text(`${report.score} out of 100: ${band}`, 17, ink, true);
  text(
    "This score does not measure lost enquiries or promise a place in search results.",
  );

  const rows = [
    [
      "Main content loads",
      report.metrics.lcp,
      "When the main picture or text appears.",
    ],
    [
      "Time spent stuck",
      report.metrics.tbt,
      "Delays while the page is busy starting up.",
    ],
    [
      "Page movement",
      report.metrics.cls,
      "How much content shifts while loading. Lower is better.",
    ],
    [
      "First content appears",
      report.metrics.fcp,
      "When the first text or image appears.",
    ],
    [
      "Visible page fills in",
      report.metrics.si,
      "How quickly the visible parts of the page appear.",
    ],
    [
      "Page ready to respond",
      report.metrics.tti,
      "When this test found the page ready for input.",
    ],
  ];
  for (const [label, value, explanation] of rows) {
    ensureSpace(23);
    doc.setDrawColor("#e2e8f0").line(18, y - 1, 192, y - 1);
    y += 5;
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(ink);
    doc.text(label, 18, y);
    doc.text(normalise(value || "Not available"), 192, y, { align: "right" });
    y += 6;
    text(explanation, 9);
  }
  doc.addPage();
  header("What to check next");
  text("Use the findings as a starting point", 20, ink, true);
  text(
    "These checks flag things worth a closer look. They do not prove which change will help most.",
  );
  text(
    "Any estimates below come from Google. Do not add them together or treat them as promised savings.",
  );
  if (!report.metrics.opportunities.length) {
    text(
      "The test returned no findings in the checks this report covers. That does not mean the site has no issues.",
    );
  }
  report.metrics.opportunities.forEach((finding, index) => {
    const [title, action] = describeScannerFinding(finding.id);
    ensureSpace(34);
    text(`${index + 1}. ${title}`, 12, ink, true);
    text(action);
    if (finding.savings) text(`Google's estimate: ${finding.savings}`, 9);
    y += 3;
  });
  ensureSpace(100);
  y += 5;
  text("Try the page yourself, too", 16, ink, true);
  text(
    "Open the page on your phone. Check that its links and forms work. Repeat the test after making a change.",
  );
  link(
    "Read Kaizen's guide to your speed report",
    "https://kaizenweb.co.uk/blog/free-website-speed-scan/",
  );
  link(
    "Read how Google's speed test works",
    "https://developers.google.com/speed/docs/insights/v5/about",
  );
  text("Talk to us about your site", 16, ink, true);
  text(
    "We can help you read the report and choose what to check. The first conversation is free.",
  );
  link("Contact Kaizen about your site", "https://kaizenweb.co.uk/contact/");
  text(
    "One of us will get back to you the same day, or the next working day at the latest.",
    9,
  );
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc
      .setPage(page)
      .setFont("helvetica", "normal")
      .setFontSize(8)
      .setTextColor(muted);
    doc.text("kaizenweb.co.uk | Website speed check", 18, 286);
    doc.text(`${page} / ${pages}`, 192, 286, { align: "right" });
  }
  return doc;
}
