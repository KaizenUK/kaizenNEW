import type { APIRoute } from "astro";
import type { DemoResponse } from "../../../shared/api";

export const GET: APIRoute = async () => {
  const response: DemoResponse = { message: "Hello from Astro server" };
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
