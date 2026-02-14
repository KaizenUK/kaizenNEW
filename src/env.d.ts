/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_SANITY_PROJECT_ID?: string;
  readonly NEXT_PUBLIC_SANITY_DATASET?: string;
  readonly PUBLIC_SANITY_PROJECT_ID?: string;
  readonly PUBLIC_SANITY_DATASET?: string;
  readonly SANITY_PROJECT_ID?: string;
  readonly SANITY_DATASET?: string;
  readonly SANITY_API_TOKEN?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly NEXT_PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
