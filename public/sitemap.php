<?php
// sitemap.php – dynamic sitemap for kaizenweb.co.uk
// Generates sitemap with static pages (dated by build) and dynamic WP posts

header('Content-Type: application/xml; charset=UTF-8');

$base = 'https://kaizenweb.co.uk';

/**
 * Normalise URLs:
 * - ensures exactly one slash between base and path
 * - removes trailing slash (except for homepage "/")
 */
function build_loc(string $base, string $path): string {
    $base = rtrim($base, '/');

    if ($path === '/' || $path === '') {
        return $base . '/';
    }

    $path = '/' . ltrim($path, '/');
    $loc  = $base . $path;

    return rtrim($loc, '/');
}

// Read build timestamp if available (set during npm run build)
$buildTimestamp = null;
$timestampFile = dirname(__FILE__) . '/build-timestamp.txt';
if (file_exists($timestampFile)) {
    $buildTimestamp = trim(file_get_contents($timestampFile));
}

// If no build timestamp found, use current date
if (!$buildTimestamp) {
    $buildTimestamp = date('c');
}

// ====================================================================
// 1) Static pages with build timestamp as lastmod
// EXCLUDED from sitemap: policy pages (not indexed)
// - /privacy-policy
// - /cookie-policy
// - /gdpr-policy
// - /thank-you
// ====================================================================
$staticPaths = [
    '/',
    '/services',
    '/services/web-design-liverpool',
    '/web-design-wirral',
    '/services/wordpress-web-design',
    '/services/ecommerce',
    '/web-design-liverpool-city-centre',
    '/services/digital-transformation',
    '/services/local-seo',
    '/project-rescue',
    '/contract-product-owner',
    '/agile-coaching',
    '/product-owner',
    '/case-studies',
    '/case-studies/as-collections',
    '/case-studies/helen-moore-hairdressing',
    '/case-studies/independent-retailer',
    '/case-studies/kaizen-rebuild',
    '/pledge',
    '/about',
    '/contact',
    '/blog',
];

$urls = [];

// Build static URL entries with lastmod = build timestamp
foreach ($staticPaths as $path) {
    $urls[] = [
        'loc' => build_loc($base, $path),
        'lastmod' => $buildTimestamp,
    ];
}

// ====================================================================
// 2) Dynamic blog posts from WordPress CMS (pulls latest on each crawl)
// ====================================================================
$endpoint = $base . '/cms/wp-json/wp/v2/posts?status=publish&per_page=100&_fields=slug,modified';

// Set timeout to 5 seconds to avoid hanging
$ctx  = stream_context_create(['http' => ['timeout' => 5]]);
$json = @file_get_contents($endpoint, false, $ctx);

if ($json !== false) {
    $posts = json_decode($json, true);

    if (is_array($posts)) {
        foreach ($posts as $post) {
            if (empty($post['slug'])) {
                continue;
            }

            $loc = build_loc($base, '/blog/' . $post['slug']);
            $entry = ['loc' => $loc];

            // Use WordPress modified timestamp if available
            if (!empty($post['modified'])) {
                $ts = strtotime($post['modified']);
                if ($ts !== false) {
                    $entry['lastmod'] = date('c', $ts);
                }
            }

            $urls[] = $entry;
        }
    }
}

// ====================================================================
// 3) Output XML sitemap
// ====================================================================
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

foreach ($urls as $url) {
    echo "  <url>\n";
    echo '    <loc>' . htmlspecialchars($url['loc'], ENT_XML1) . "</loc>\n";

    if (!empty($url['lastmod'])) {
        echo '    <lastmod>' . $url['lastmod'] . "</lastmod>\n";
    }

    echo "  </url>\n";
}

echo "</urlset>\n";
