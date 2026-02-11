import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const ping = process.env.PING_MESSAGE ?? "ping";
  return new Response(JSON.stringify({ message: ping }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
