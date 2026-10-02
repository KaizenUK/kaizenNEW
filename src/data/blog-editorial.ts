// Editorial dates record a completed content review, never a build or CMS edit.
// Update a date only after checking the article and its sources; keep the proof
// in docs/audits. New articles need their own reviewed entry.
export const BLOG_REVIEWS: Record<string, { checkedOn: string; evidence: string }> = {
  "wp-post-97": { checkedOn: "2026-10-02", evidence: "2026-10-02-b03-comparison-proof.md" },
  "wp-post-93": { checkedOn: "2026-10-02", evidence: "2026-10-02-b03-hidden-proof.md" },
  "wp-post-42": { checkedOn: "2026-10-02", evidence: "2026-10-02-b03-local-proof.md" },
  "wp-post-16": { checkedOn: "2026-10-02", evidence: "2026-10-02-b03-cost-proof.md" },
  "wp-post-50": { checkedOn: "2026-10-02", evidence: "2026-10-02-b03-mistakes-proof.md" },
  "wp-post-102": { checkedOn: "2026-10-02", evidence: "2026-10-02-b04-proof.md" },
  "wp-post-183": { checkedOn: "2026-10-02", evidence: "2026-10-02-b02-proof.md" },
  "wp-post-34": { checkedOn: "2026-10-02", evidence: "2026-10-02-b02-proof.md" },
  "wp-post-13": { checkedOn: "2026-10-02", evidence: "2026-10-02-b02-proof.md" },
};

// Also supplies the author page when CMS configuration is absent locally.
export const SEAN_AUTHOR = {
  _id: "author-sean-mcdonnell",
  name: "Sean McDonnell",
  slug: "sean-mcdonnell",
  role: "Founder of Kaizen",
  bio: "Sean founded Kaizen. He works on business websites and helps owners decide what their software needs to do. These guides draw on that work and the sources linked in each article.",
};
