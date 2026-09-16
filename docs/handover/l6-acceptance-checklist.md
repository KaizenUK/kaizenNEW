# L6 acceptance — what only Sean can check

L6 is installed and live. Production serves release `l6-main-2` and staging `l6-stage-15`. Release retention and native file cleanup are deliberately switched off until the checks below pass, because they are the only parts that delete anything.

Everything here needs a real signed-in session, which is why it could not be verified for you. None of it takes long.

## Try the product once (production)

Open <https://kaizenweb.co.uk/builder/> and sign in with your existing account. New accounts cannot be created yet: sign-up is switched off in Supabase Auth and no email sender is configured.

1. **Edit and save a page.** Change some text, save, reload the page and confirm the change survived.
2. **Upload an image.** This is the one path that changed most: browser uploads no longer write straight to storage, they reserve their allowance through the new upload service. A refusal that mentions checking storage means the service is unreachable; a stored image means the whole chain works.
3. **Publish.** Watch it through Releases until it reports live, then load the public page.
4. **Restore the previous release** from Releases, confirm the site serves the older version, then publish again to move forward. Rolling back is already proven on staging from the server side; this checks the same thing from the editor.
5. **Open Releases history.** Confirm older releases are listed and that anything no longer available is shown as such rather than offering a restore that cannot work.
6. **Client website (optional).** In the client-demo project, publish and then take the website offline, to exercise the client publication path end to end.

Tell me which of these worked. If any step fails, the failure message is designed to say what to do; send it to me verbatim.

## What I switch on once those pass

1. `BUILDER_RELEASE_RETENTION_ENABLED=1` in the two deployment environments and the client worker.
2. Re-register the native configuration with cleanup allowed.
3. Enable the maintenance and native cleanup timers, then watch their first runs and confirm retained releases and rollback targets still exist.

Details are in [the installation plan](../builder-t4-installation.md) under step 11.

## Activation settings, ready to paste

**Payments.** Set these as Supabase function settings (never in frontend settings): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BUILDER_STRIPE_LIVE_MODE`, `BUILDER_STRIPE_PRICE_PLUS`, `BUILDER_STRIPE_PRICE_AGENCY`, `BUILDER_STRIPE_PORTAL_CONFIGURATION`. The two prices must be different, active, monthly GBP prices in the mode you choose.

Point the Stripe endpoint at `https://kbqraygsegcclzhsmpvz.functions.supabase.co/builder-billing-webhook` (it already answers, refusing anything unsigned with a plain 400) and subscribe it to `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed` and `checkout.session.expired`. Test mode first is fine; the code refuses deliveries from the opposite mode.

**Sign-up.** Configure the sender under Auth, then switch `disable_signup` off. The confirmation redirect addresses are already correct: the site address is `https://kaizenweb.co.uk/builder/` and both `kaizenweb.co.uk` and `www.kaizenweb.co.uk` are allowed.

**Continuous integration.** `builder-checks` runs on a pull request or a workflow dispatch. Both need a GitHub credential this machine does not have, so the end-of-goal CI run is yours: open a pull request at the current revision, or dispatch the workflow. If you would rather I did it in future, leave a fine-grained token (Contents: read/write) at `/home/sean/.config/kaizen/github-token.txt`.

## Decisions only you can make

- **Payments.** Stripe secret key, webhook secret and price IDs, plus the decision to charge real customers. The billing functions are deployed and waiting; nothing can be bought until those exist.
- **Sign-up email.** Choose a sender and SMTP provider, then sign-up can be switched on. Both belong together: without a sender, new accounts could never confirm.
- **Custom domains.** Cloudflare access, so the domain worker can accept a real domain. The worker is installed, enabled and idle.
- **Studio address.** `studio.kaizenweb.co.uk` has a web server entry but no DNS record anywhere, so the Studio is unreachable by that name.
- **Paid Supabase plan**, if you want always-on point-in-time recovery and rejection of passwords known to be breached. Today there is a verified nightly backup and a 12-character minimum.
- **Terms and Privacy wording**, and where the public "Report a website" page belongs. The reporting function is live and refuses anything that is not a Kaizen-hosted website.
- **Git credential.** The repository remote had a password embedded in its URL; it has been removed. Treat that password as exposed, and know that pushing from this machine now goes through the server's deploy key.
