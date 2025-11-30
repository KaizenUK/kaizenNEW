import { SITE_URL, SITE_NAME } from "./seo";

interface BreadcrumbItem {
  name: string;
  url: string;
}

export const generateBreadcrumbSchema = (pathname: string) => {
  const segments = pathname.split("/").filter(Boolean);
  
  if (segments.length === 0) {
    return null;
  }

  const breadcrumbs: BreadcrumbItem[] = [
    {
      name: SITE_NAME,
      url: SITE_URL,
    },
  ];

  let currentPath = "";
  for (let i = 0; i < segments.length; i++) {
    currentPath += `/${segments[i]}`;
    const name = segments[i]
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    
    breadcrumbs.push({
      name,
      url: `${SITE_URL}${currentPath}`,
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
};
