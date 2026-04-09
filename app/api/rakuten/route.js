import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID;

async function fetchBooks(q, langRestrict) {
  const params = new URLSearchParams({ q, maxResults: 10, printType: "books", orderBy: "relevance", langRestrict: langRestrict || "ja" });
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

  // タイトル限定検索を優先、結果が少なければ全フィールド検索で補充
  const intitleItems = await fetchBooks(`intitle:${title}`);
  let results = intitleItems.filter((i) => i.volumeInfo.language === "ja");

  if (results.length < 3) {
    const broadItems = await fetchBooks(title);
    const seen = new Set(results.map((i) => i.id));
    for (const item of broadItems) {
      if (!seen.has(item.id) && item.volumeInfo.language === "ja") {
        results.push(item);
        seen.add(item.id);
      }
    }
  }

  return NextResponse.json({ items: results.slice(0, 5).map(mapItem) });
}
