import { NextResponse } from "next/server";

const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID;

async function fetchBooks(query) {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&printType=books&orderBy=relevance`
  );
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
  return { title: info.title, author: info.authors?.join(", ") || "", coverUrl: cover, rakutenUrl, isbn, lang: info.language };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  // 日本語版優先: langRestrict=jaで検索、足りなければ全言語から補充
  const [jaItems, allItems] = await Promise.all([
    fetchBooks(`${title} langRestrict:ja`),
    fetchBooks(title),
  ]);

  // ja判定してマージ・重複除去
  const seen = new Set();
  const merged = [];
  for (const item of [...jaItems, ...allItems]) {
    const id = item.id;
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(item);
  }

  // language=jaを上位に
  merged.sort((a, b) => {
    const aJa = a.volumeInfo.language === "ja" ? 0 : 1;
    const bJa = b.volumeInfo.language === "ja" ? 0 : 1;
    return aJa - bJa;
  });

  const items = merged.slice(0, 5).map(mapItem);
  return NextResponse.json({ items });
}
