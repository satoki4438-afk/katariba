import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID;

async function googleBooksSearch(q) {
  const params = new URLSearchParams({ q, langRestrict: "ja", maxResults: 10, printType: "books" });
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
  const data = await res.json();
  return (data.items || []).filter((item) => item.volumeInfo.language === "ja");
}

function mapItem(item) {
  const info = item.volumeInfo;
  const isbn = info.industryIdentifiers?.find((id) => id.type === "ISBN_13")?.identifier
    || info.industryIdentifiers?.find((id) => id.type === "ISBN_10")?.identifier;
  const rakutenUrl = isbn && AFFILIATE_ID
    ? `https://hb.afl.rakuten.co.jp/hgc/${AFFILIATE_ID}/?pc=${encodeURIComponent(`https://books.rakuten.co.jp/search?sitem=${isbn}`)}`
    : null;
  return {
    title: info.title,
    author: info.authors?.join(", ") || "",
    coverUrl: info.imageLinks?.thumbnail?.replace("http://", "https://") || null,
    rakutenUrl,
    isbn,
    description: info.description || null,
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  // まずタイトル限定で検索
  let results = await googleBooksSearch(`intitle:${title}`);

  // 3件未満なら全フィールド検索で補充
  if (results.length < 3) {
    const broad = await googleBooksSearch(title);
    const seen = new Set(results.map((i) => i.id));
    for (const item of broad) {
      if (!seen.has(item.id)) results.push(item);
    }
  }

  return NextResponse.json({ items: results.slice(0, 5).map(mapItem) });
}
