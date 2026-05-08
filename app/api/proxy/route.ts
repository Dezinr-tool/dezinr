import { NextResponse } from "next/server";

function isSkippableUrl(value: string) {
  const lower = value.toLowerCase();
  return (
    lower.startsWith("#") ||
    lower.startsWith("javascript:") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("data:")
  );
}

function toAbsoluteUrl(value: string, baseUrl: URL): string {
  if (isSkippableUrl(value)) return value;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function toProxyUrl(value: string, baseUrl: URL): string {
  if (isSkippableUrl(value)) return value;
  try {
    const resolved = new URL(value, baseUrl);
    return `/api/proxy?url=${encodeURIComponent(resolved.toString())}`;
  } catch {
    return value;
  }
}

function rewriteTagAttributes(tag: string, baseUrl: URL): string {
  return tag.replace(
    /\b(href|src|action)\s*=\s*(["'])(.*?)\2/gi,
    (match, attrName: string, quote: string, rawValue: string) => {
      const tagName = tag.match(/^<\s*([a-z0-9:-]+)/i)?.[1]?.toLowerCase() ?? "";
      const attr = attrName.toLowerCase();
      const value = rawValue.trim();

      if (!value) return match;

      let rewritten = value;
      if (attr === "src") {
        rewritten = toAbsoluteUrl(value, baseUrl);
      } else if (attr === "action") {
        rewritten = toProxyUrl(value, baseUrl);
      } else if (attr === "href") {
        rewritten = tagName === "a" ? toProxyUrl(value, baseUrl) : toAbsoluteUrl(value, baseUrl);
      }

      return `${attr}=${quote}${rewritten}${quote}`;
    },
  );
}

function rewriteHtmlUrls(html: string, baseUrl: URL): string {
  const rewrittenTags = html.replace(/<[^>]+>/g, (tag) => rewriteTagAttributes(tag, baseUrl));
  return rewrittenTags.replace(
    /url\(\s*(["']?)(.*?)\1\s*\)/gi,
    (match, quote: string, rawValue: string) => {
      const value = rawValue.trim();
      if (!value) return match;
      const absolute = toAbsoluteUrl(value, baseUrl);
      return `url(${quote}${absolute}${quote})`;
    },
  );
}

function injectBaseTag(html: string, baseUrl: URL): string {
  const baseTag = `<base href="${baseUrl.origin}/">`;
  if (/<base\s+href=/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  }
  return `${baseTag}${html}`;
}

function injectScrollBridge(html: string): string {
  const script = `<script>
window.addEventListener('scroll', function() {
  window.parent.postMessage({type:'scroll', scrollY: window.scrollY}, '*');
});
</script>`;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${script}</body>`);
  }
  return `${html}${script}`;
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
        "User-Agent": "Mozilla/5.0 (compatible browser)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream failed with status ${upstream.status}` },
        { status: 502 },
      );
    }

    const body = await upstream.text();
    const rewritten = rewriteHtmlUrls(body, parsed);
    const withBase = injectBaseTag(rewritten, parsed);
    const modified = injectScrollBridge(withBase);

    return new NextResponse(modified, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "ALLOWALL",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[api/proxy] unhandled", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
