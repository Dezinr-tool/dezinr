import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withBaseTag(html: string, target: URL) {
  const baseTag = `<base href="${target.origin}/">`;
  if (/<base\s+href=/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  }
  return `${baseTag}${html}`;
}

export async function GET(request: Request) {
  let browser: puppeteer.Browser | null = null;
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

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1200 });
    await page.goto(parsed.toString(), {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let currentPos = 0;
        const step = 600;
        const timer = setInterval(() => {
          window.scrollTo(0, currentPos);
          currentPos += step;
          const pageHeight = Math.max(
            document.body?.scrollHeight || 0,
            document.documentElement?.scrollHeight || 0,
          );
          if (currentPos >= pageHeight) {
            window.scrollTo(0, 0);
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });

      document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => {
        img.loading = "eager";
        if (img.dataset?.src) img.src = img.dataset.src;
      });

      await Promise.all(
        Array.from(document.images).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          });
        }),
      );
    });

    const html = await page.content();
    const finalHtml = withBaseTag(html, parsed);

    return new NextResponse(finalHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/render] unhandled", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
