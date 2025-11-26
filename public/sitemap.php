<?php
// sitemap.php – dynamic sitemap for kaizenweb.co.uk

header('Content-Type: application/xml; charset=UTF-8');

$base = 'https://www.kaizenweb.co.uk';

// ---------------------------------------------------------------------
// 1. Static pages – all your key marketing URLs
// ---------------------------------------------------------------------

$staticPaths = [
    '/',                                        // Home
    '/services/web-design-liverpool',
    '/services/wordpress-web-design',
    '/services/ecommerce',                      // adjust if your actual route is different
    '/services/local-seo',
    '/services/digital-transformation',

    '/agile-coaching',                          // if the live route is /services/agile-coaching, change/remove as needed
    '/contract-product-owner',                  // same note as above
    '/services/agile-coaching',                 // included because it appeared in your earlier XML snippet
    '/services/contract-product-owner',

    '/about',
    '/pledge',
    '/case-studies',
    '/case-studies/as-collections',
    '/case-studies/helen-moore-hairdressing',
    '/case-studies/independent-retailer',
    '/blog',
    '/project-rescue',
    '/contact',
    '/web-design-liverpool-city-centre',
    '/privacy-policy',
    '/gdpr-policy',
];

$urls = [];

// Build static URL entries
foreach ($staticPaths as $path) {
    // Normalise base + path (avoid double slashes)
    $loc = rtrim($base, '/') . $path;

    $urls[] = [
        'loc' => $loc,
        // no changefreq/priority – optional in sitemaps
    ];
}

// ---------------------------------------------------------------------
// 2. Dynamic blog posts from headless WP (/cms)
// ---------------------------------------------------------------------

// WordPress REST API endpoint to fetch published posts
$endpoint = 'https://www.kaizenweb.co.uk/cms/wp-json/wp/v2/posts?status=publish&per_page=100&_fields=slug,modified';

$json = @file_get_contents($endpoint);

if ($json !== false) {
    $posts = json_decode($json, true);

    if (is_array($posts)) {
        foreach ($posts as $post) {
            if (empty($post['slug'])) {
                continue;
            }

            $slug = $post['slug'];

            // Front-end URL pattern for blog posts
            $loc = rtrim($base, '/') . '/blog/' . $slug . '/';

            $entry = [
                'loc' => $loc,
            ];

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
// 3. Output XML
// ---------------------------------------------------------------------

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

foreach ($urls as $url) {
    echo "  <url>\n";
    echo '    <loc>' . htmlspecialchars($url['loc'], ENT_XML1) . '</loc>' . "\n";

    if (!empty($url['lastmod'])) {
        echo '    <lastmod>' . $url['lastmod'] . '</lastmod>' . "\n";
    }

    echo "  </url>\n";
}

echo "</urlset>\n";
