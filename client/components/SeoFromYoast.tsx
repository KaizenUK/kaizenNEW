import { Helmet } from "react-helmet-async";

type YoastHeadJson = {
  title?: string;
  description?: string;
  canonical?: string;
  og_title?: string;
  og_description?: string;
  og_url?: string;
  og_image?: { url?: string }[];
  twitter_title?: string;
  twitter_description?: string;
  twitter_image?: string;
};

export function SeoFromYoast({ yoast }: { yoast?: YoastHeadJson }) {
  if (!yoast) return null;

  return (
    <Helmet>
      {yoast.title && <title>{yoast.title}</title>}
      {yoast.description && (
        <meta name="description" content={yoast.description} />
      )}
      {yoast.canonical && (
        <link
          rel="canonical"
          href={yoast.canonical.split("?")[0]}
        />
      )}

      {yoast.og_title && <meta property="og:title" content={yoast.og_title} />}
      {yoast.og_description && (
        <meta property="og:description" content={yoast.og_description} />
      )}
      {yoast.og_url && <meta property="og:url" content={yoast.og_url} />}
      {yoast.og_image?.[0]?.url && (
        <meta property="og:image" content={yoast.og_image[0].url} />
      )}

      {yoast.twitter_title && (
        <meta name="twitter:title" content={yoast.twitter_title} />
      )}
      {yoast.twitter_description && (
        <meta name="twitter:description" content={yoast.twitter_description} />
      )}
      {yoast.twitter_image && (
        <meta name="twitter:image" content={yoast.twitter_image} />
      )}
    </Helmet>
  );
}
