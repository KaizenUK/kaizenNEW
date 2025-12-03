<?php
// sitemap.php – dynamic sitemap for kaizenweb.co.uk

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

    // Remove trailing slash (but keep homepage as "/")
    return rtrim($loc, '/');
}

// ---------------------------------------------------------------------
// 1) Static pages – EXACT set you requested
// ---------------------------------------------------------------------
$staticPaths = [
    '/',
    '/services',
    '/services/web-design-liverpool',
    '/web-design-wirral',
    '/services/wordpress-web-design',
    '/services/ecommerce',
    '/web-design-liverpool-city-centre',
    '/services/digital-transformation',
    '/project-rescue',
    '/contract-product-owner',
    '/agile-coaching',
    '/blog',

    '/case-studies',
    '/case-studies/as-collections',
    '/case-studies/helen-moore-hairdressing',
    '/case-studies/independent-retailer',
    '/case-studies/kaizen-rebuild',

    '/pledge',
    '/about',
    '/contact',

    // policies
 
];

$urls = [];

// Build static URL entries
foreach ($staticPaths as $path) {
    $urls[] = [
        'loc' => build_loc($base, $path),
    ];
}

// ---------------------------------------------------------------------
// 2) Dynamic blog posts from headless WP (/cms)
// ---------------------------------------------------------------------
$endpoint = $base . '/cms/wp-json/wp/v2/posts?status=publish&per_page=100&_fields=slug,modified';

$json = @file_get_contents($endpoint);

if ($json !== false) {
    $posts = json_decode($json, true);

    if (is_array($posts)) {
        foreach ($posts as $post) {
            if (empty($post['slug'])) {
                continue;
            }

            $slug = $post['slug'];

            // IMPORTANT: no trailing slash to avoid 301 redirects in sitemap
            $loc = build_loc($base, '/blog/' . $slug);

            $entry = ['loc' => $loc];

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

// ---------------------------------------------------------------------
// 3) Output XML
// ---------------------------------------------------------------------
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
