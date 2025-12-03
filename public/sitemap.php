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

    return rtrim($loc, '/');
}

// ---------------------------------------------------------------------
// 1) Static pages – EXACT set you listed
// ---------------------------------------------------------------------
$staticPaths = [
    '/',
    '/services/web-design-liverpool',
    '/web-design-wirral',
    '/services/wordpress-web-design',
    '/services/ecommerce',
    '/web-design-liverpool-city-centre',
    '/project-rescue',
    '/contract-product-owner',
    '/agile-coaching',
    '/services/digital-transformation',
    '/case-studies/as-collections',
    '/case-studies/helen-moore-hairdressing',
    '/case-studies/kaizen-rebuild',
    '/pledge',
    '/about',
    '/contact',
    '/blog',
];

$urls = [];

foreach ($staticPaths as $path) {
    $urls[] = [
        'loc' => build_loc($base, $path),
    ];
}

// ---------------------------------------------------------------------
// 2) Dynamic blog posts from headless WP (/cms)
// ---------------------------------------------------------------------
$endpoint = $base . '/cms/wp-json/wp/v2/posts?status=publish&per_page=100&_fields=slug,modified';

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
