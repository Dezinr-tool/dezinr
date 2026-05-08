export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url');
  if (!url) return new Response('URL required', { status: 400 });
  try {
    const res = await fetch('http://localhost:3001/render?url=' + encodeURIComponent(url));
    const html = await res.text();
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (e) {
    return new Response('Render service unavailable', { status: 502 });
  }
}
