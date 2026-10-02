# Guide cards and reading pages

The guide index adapts Untitled UI's Simple 01 pattern: image, date, linked title, short description and author, in a responsive grid. Cards follow their content on phones. No equal-height grid rows, featured-card span, filters or newsletter form are carried over.

On 2 October 2026, the official catalogue, DOM and rendered previews were inspected for [Featured post 01](https://www.untitledui.com/react/marketing/blog-sections/blog-header-featured-post-01), [Simple 01](https://www.untitledui.com/react/marketing/blog-sections/blog-header-simple-01) and [Blog post 01](https://www.untitledui.com/react/marketing/blog-post-pages/blog-post-01). The Simple 01 grid suits the nine guides; the post example informs the clear title, media and narrow reading column. Kaizen's existing F foundations supply the actual navigation, fonts, colours and buttons. No example text, photographs or claims are copied.

The signed-in CLI search found the recommended components, but both its source download and the corresponding API returned no components/404. This implementation is a local adaptation of the inspected public patterns, not a claim that the Pro source was installed. Preview evidence is saved privately under `.local/marketing-20261001/b01-preview-*`.

`GuideCard` is server-rendered without hydration. Its one link is labelled by the title; no author link is nested inside it. Article bylines link to the separate author page. Image dimensions match the requested crop. Only the first index image is eager.

The blog layout imports the main stylesheet and adds scoped rules from `src/styles/blog.css`. The body uses `marketing-page blog-page`; reading rules use `guide-prose`. Code blocks retain their own dark surface. Keep source text, link destinations, review records and publication timestamps independent of the layout.
