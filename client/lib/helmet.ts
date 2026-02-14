import * as helmetNs from "react-helmet-async";

const helmetAny = helmetNs as unknown as Record<string, unknown>;
const helmetAsync = (helmetAny["default"] ?? helmetAny) as {
  Helmet: typeof import("react-helmet-async").Helmet;
  HelmetProvider: typeof import("react-helmet-async").HelmetProvider;
};
const { Helmet, HelmetProvider } = helmetAsync;

export { Helmet, HelmetProvider };
