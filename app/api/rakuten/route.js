import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const APP_ID = process.env.RAKUTEN_API_KEY;
const ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const params = new URLSearchParams({
    applicationId: APP_ID,
    accessKey: ACCESS_KEY,
    title,
    hits: 5,
    formatVersion: 2,
  });

  const res = await fetch(
    `https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404?${params}`
  );
  const data = await res.json();

  if (data.error || !data.Items || data.Items.length === 0) {
    return NextResponse.json({ items: [], _debug: data });
  }

  const items = data.Items.map((b) => {
    const rakutenUrl = AFFILIATE_ID && b.itemUrl
      ? `https://hb.afl.rakuten.co.jp/hgc/${AFFILIATE_ID}/?pc=${encodeURIComponent(b.itemUrl)}`
      : b.itemUrl || null;
    return {
      title: b.title,
      author: b.author || "",
      coverUrl: b.largeImageUrl || b.mediumImageUrl || null,
      rakutenUrl,
      isbn: b.isbn || null,
      description: null,
    };
  });

  return NextResponse.json({ items });
}
