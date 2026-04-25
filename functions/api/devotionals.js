export async function onRequestGet(context) {
  const supabaseUrl = context.env.SUPABASE_URL;
  const supabaseAnon = context.env.SUPABASE_ANON;

  if (!supabaseUrl || !supabaseAnon) {
    return Response.json(
      { error: "missing-supabase-env" },
      {
        status: 500,
        headers: { "cache-control": "no-store" }
      }
    );
  }

  const url = supabaseUrl.replace(/\/+$/, "") + "/rest/v1/devotionals?select=*&order=entry_date.desc";

  try {
    const upstream = await fetch(url, {
      headers: {
        apikey: supabaseAnon,
        Authorization: "Bearer " + supabaseAnon
      }
    });

    if (!upstream.ok) {
      return Response.json(
        { error: "upstream-failed", status: upstream.status },
        {
          status: upstream.status,
          headers: { "cache-control": "no-store" }
        }
      );
    }

    return new Response(await upstream.text(), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    return Response.json(
      { error: "proxy-failed", message: String(error && error.message || error) },
      {
        status: 502,
        headers: { "cache-control": "no-store" }
      }
    );
  }
}
