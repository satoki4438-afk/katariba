import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID;

async function fetchBooks(title, langRestrict) {
  const params = new URLSearchParams({ q: title, maxResults: 10, printType: "books", orderBy: "relevance" });
  if (langRestrict) params.set("langRestrict", langRestrict);
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
  const data = await res.json();
  return data.items || [];
}

function mapItem(item) {
  const info = item.volumeInfo;
  const isbn = info.industryIdentifiers?.find((id) => id.type === "ISBN_13")?.identifier
    || info.industryIdentifiers?.find((id) => id.type === "ISBN_10")?.identifier;
  const rakutenUrl = isbn && AFFILIATE_ID
    ? `https://hb.afl.rakuten.co.jp/hgc/${AFFILIATE_ID}/?pc=${encodeURIComponent(`https://books.rakuten.co.jp/search?sitem=${isbn}`)}`
    : null;
  const cover = info.imageLinks?.thumbnail?.replace("http://", "https://") || null;
  return { title: info.title, author: info.authors?.join(", ") || "", coverUrl: cover, rakutenUrl, isbn, lang: info.language, description: info.description || null };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const [jaItems, allItems] = await Promise.all([
    fetchBooks(title, "ja"),
    fetchBooks(title, null),
  ]);

  const seen = new Set();
  const merged = [];
  for (const item of [...jaItems, ...allItems]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }

  merged.sort((a, b) => (a.volumeInfo.language === "ja" ? 0 : 1) - (b.volumeInfo.language === "ja" ? 0 : 1));

  return NextResponse.json({ items: merged.slice(0, 5).map(mapItem) });
}
