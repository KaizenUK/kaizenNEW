export type BuilderRedirect = {
  id: string;
  source: string;
  destination: string;
  status: 301 | 302;
};
export type RouteState = {
  version: number;
  draft: BuilderRedirect[];
  published: BuilderRedirect[];
  revisions: { id: string; createdAt: string; rules: BuilderRedirect[] }[];
};
