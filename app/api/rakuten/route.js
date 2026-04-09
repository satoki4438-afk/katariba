import { NextResponse } from "next/server";

const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}&langRestrict=ja&maxResults=5&printType=books`
  );
  const data = await res.json();

  if (!data.items || data.items.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const items = data.items.map((item) => {
    const info = item.volumeInfo;
    const isbn = info.industryIdentifiers?.find((id) => id.type === "ISBN_13")?.identifier
      || info.industryIdentifiers?.find((id) => id.type === "ISBN_10")?.identifier;

    const rakutenUrl = isbn && AFFILIATE_ID
      ? `https://hb.afl.rakuten.co.jp/hgc/${AFFILIATE_ID}/?pc=https://books.rakuten.co.jp/search?sitem=${isbn}&m=http://m.rakuten.co.jp/books/search/?sitem=${isbn}`
      : null;

    const cover = info.imageLinks?.thumbnail?.replace("http://", "https://") || null;

    return {
      title: info.title,
      author: info.authors?.join(", ") || "",
      coverUrl: cover,
      rakutenUrl,
      isbn,
    };
  });

  return NextResponse.json({ items });
}
