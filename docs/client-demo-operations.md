# Client demo on the production VPS

Configured 11 September 2026 for the explicitly authorised acceptance hostname, `https://client-demo.kaizenweb.co.uk`.

- Hosted project: **Client demo acceptance**, `fb86c9f8-b48a-404e-a3cd-6f43f9bdc07b`. Sean has owner and publish permission.
- Production destination: `d2dc035d-1f2c-4fcf-8404-4194786f512f`, label **Client demo — VPS**.
- Cloudflare remains authoritative. The demo A record points to `144.91.72.17` and uses **DNS only**. Managed Cloudflare robots content changed the released `robots.txt`; strict served-file verification rejected that release and restored the bootstrap. Other DNS records were not changed.
- DirectAdmin user `kaizenweb` owns the `client-demo` subdomain. Its document root is `/home/kaizenweb/domains/client-demo.kaizenweb.co.uk/public_html`.
- The client-only branch in `kaizenweb.co.uk.cust_httpd` redirects HTTP to HTTPS, exempts the ACME challenge, selects the dedicated certificate, and proxies to Nginx on `127.0.0.1:8092`. The original apex and other subdomain branches retain their previous configuration. DirectAdmin template conditionals are kept flat.
- Nginx includes `/var/lib/kaizen-client-releases/client-demo/active.conf`. This bound release store is separate from Kaizen's `/var/lib/kaizen/production` store.
- `/etc/kaizen/client-destinations.json` contains the explicit binding. `/opt/kaizen-builder` is an operator-installed tooling archive, not a Git checkout. Its release verifier includes commit `6d74884`'s Cloudflare AJAX-header fix.
- Worker private jobs use `/var/lib/kaizen-client-worker/jobs`, not the system account's home itself. The first queued attempt correctly rejected using the home directory. Service credentials remain in `/etc/kaizen/client-worker.env`, mode `0600`.
- `/etc/sudoers.d/kaizen-client-worker` permits only Nginx validation and reload. Private job files are not publicly served.

## HTTPS renewal

The existing Lego executable issued a separate Let's Encrypt certificate for the demo; the parent domain certificate was not replaced. Keys and ACME account data live under `/var/lib/kaizen-client-tls/client-demo` with private directory permissions. The dedicated DirectAdmin custom branch selects its certificate and key.

`kaizen-client-demo-tls.timer` checks daily with a random delay and renews with 30 days remaining. `kaizen-client-demo-tls.service` uses HTTP validation through the existing `/var/www/html/.well-known/acme-challenge` alias. The root-owned `/usr/local/sbin/kaizen-client-demo-tls-reload` validates Apache before reload. The first renewal check passed. Keep the challenge exception and private ACME directory when maintaining this host.

## Hosted acceptance evidence

The bootstrap artifact `client-demo-bootstrap` passed public HTTPS identity and every-file checks. A real authenticated project user saved two pages and an SVG to private project Storage, queued publication, and saved a newer draft. A subsequent real worker attempt built and downloaded the image, switched releases, detected Cloudflare's changed `robots.txt`, and restored and verified the bootstrap. The newer draft remained intact. The demo record was then changed to DNS-only.

The production worker subsequently completed publication, another distinct revision, rollback, unpublication, and restoration. The restored public artifact is `5694b3d3-35e7-4185-a427-d39adc33ba33`, with active hosted rollback job `1b96b8fc-8f3a-4bb0-b947-6fe4e526738f`. A fresh final `verify-live` passed 11 checks. `/old-about/?from=acceptance` redirects to `/about/?from=acceptance`; unpublication returned 404 for `/about/`. The newer homepage heading and description remain in the draft through rollback and unpublication; the public site intentionally shows the previous verified heading.

Browser inspection at 1440px and 390px verified the correct homepage, the actual bundled private SVG, responsive layout, shared navigation and footer, keyboard mobile-menu navigation to About, and return navigation. Both pages' images completed successfully. There was no mobile horizontal overflow or observed console warning/error. Pages carry noindex metadata for this acceptance site.

The live browser checks exposed two product bugs, now fixed: saving an existing page changed the page order (and therefore the homepage), and a display name without an extension caused media to be served with the wrong content type. Commit `b1b0a9d` preserves page order in hosted and local saves; the matching `builder-projects` function is deployed. Commit `cf16d0c` preserves the original uploaded filename in exports and the installed client renderer. Eight project/runner tests and seven export/publication tests passed, along with TypeScript. The two main production CI runs completed successfully.

A separate real unrelated account was denied project loading, release history/review, direct database data and fresh private Storage download/signing. The unrelated test account was removed. The client publication timer and HTTPS renewal timer are enabled.

Forced process-crash recovery retains its previous isolated real-Nginx evidence; it was not deliberately induced on this public host. Form delivery and a client CMS connection are not configured for this demo. Native source visual editing and the wider remaining goal are tracked in [the progress record](builder-project-progress.md).

Operator setup backups remain privately under `/root/kaizen-client-demo-setup`. The temporary publishing account was removed from project membership and its login disabled; saved test credentials were erased. Its disabled identity remains as the original Storage uploader. Sean is the project's sole owner and publisher. Private acceptance metadata retains artifact/job IDs for operator inspection, without login credentials.
