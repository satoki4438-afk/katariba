import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const appId = process.env.RAKUTEN_API_KEY;
  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID;

  const params = new URLSearchParams({
    applicationId: appId,
    title,
    hits: "5",
    formatVersion: "2",
  });
  if (affiliateId) params.set("affiliateId", affiliateId);

  const res = await fetch(
    `https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404?${params}`
  );
  const data = await res.json();

  if (!data.Items || data.Items.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const items = data.Items.map((item) => ({
    title: item.title,
    author: item.author,
    coverUrl: item.largeImageUrl || item.mediumImageUrl || null,
    rakutenUrl: affiliateId ? item.affiliateUrl : item.itemUrl,
  }));

  return NextResponse.json({ items });
}
