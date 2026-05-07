import { NextResponse } from "next/server";

function injectOverlayScript(html: string): string {
  const scriptTag = '<script src="/overlay.js"></script>';
  if (html.includes("</body>")) {
    return html.replace("</body>", `${scriptTag}</body>`);
  }
  return `${html}${scriptTag}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url")?.trim();

    if (!targetUrl) {
      return NextResponse.json({ error: "url query param required" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: "invalid url" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "unsupported protocol" }, { status: 400 });
    }

    const upstream = await fetch(parsed.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "Dezinr-QC-Proxy",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream failed with status ${upstream.status}` },
        { status: 502 },
      );
    }

    const html = await upstream.text();
    const modified = injectOverlayScript(html);

    return new NextResponse(modified, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/proxy] unhandled", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
