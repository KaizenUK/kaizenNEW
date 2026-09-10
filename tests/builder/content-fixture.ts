// Authored test content in the shape of the existing Sanity post/category projection.
export const contentFixture = {
  posts: [
    {
      _id: "design-one",
      title: "A thoughtful first impression",
      slug: "thoughtful-first-impression",
      excerpt: "A clear hierarchy helps people find their next step.",
      publishedAt: "2026-08-20T12:00:00Z",
      author: "Alex Morgan",
      image:
        "https://cdn.sanity.io/images/builder-fixture/production/landscape.svg",
      alt: "Green hills and a yellow sun",
      categories: ["design"],
    },
    {
      _id: "design-two",
      title: "Better mobile experiences",
      slug: "better-mobile-experiences",
      excerpt: "Start with the small screen and make every interaction count.",
      publishedAt: "2026-09-02T12:00:00Z",
      author: "Sam Taylor",
      image: "",
      alt: "",
      categories: ["design"],
    },
    {
      _id: "strategy-one",
      title: "Focus on useful outcomes",
      slug: "useful-outcomes",
      excerpt: "Choose the measures that matter to your visitors.",
      publishedAt: "2026-09-03T12:00:00Z",
      author: "Alex Morgan",
      image: "",
      alt: "",
      categories: ["strategy"],
    },
    {
      _id: "drafts.secret-draft",
      title: "Unpublished fixture — never show",
      slug: "unpublished",
      categories: ["design"],
    },
  ],
  categories: [
    { _id: "design", title: "Design" },
    { _id: "strategy", title: "Strategy" },
  ],
};
