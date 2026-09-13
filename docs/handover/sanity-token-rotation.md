# Sanity token configuration

The replacement supplied by Sean on 13 September 2026 authenticates against Kaizen's Sanity project `c06yyu4t`, dataset `production`. It is installed in the ignored root `.env` of the original Linux checkout and launch checkout, in the VPS production/staging private environments and root `.env.production.local` files, and in the existing Supabase project's `SANITY_API_TOKEN` secret. Local and VPS requests return HTTP 200; Supabase's stored digest matches the replacement and unrelated secrets are unchanged. No token value belongs in this guide.

Deployment reads `/etc/kaizen/production.env` for production and `/etc/kaizen/staging.env` for staging. The staging file contains its Sanity configuration and `VITE_BUILDER_CLOUD=0`; it does not contain the production release coordinator's service-role credential. The launch workflow no longer forwards GitHub's old `SANITY_API_TOKEN` setting. Existing deployed branch workflows keep their previous configuration until this change is rolled out.

The Studio environment-prefix correction already in the launch candidate is also applied to the original local and VPS checkout configurations. Their other source changes are preserved. Private backups of changed settings/configurations remain outside the repositories. Neither this credential rotation nor a successful authenticated read publishes a website or establishes the private beta gate.

For another authorized rotation, replace only the named token settings and verify authentication plus the Supabase digest. Keep production and staging environment files separate. Use the VPS environment for deployment credentials; there is no need to duplicate this token in GitHub Actions.
