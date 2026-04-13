export async function generateMetadata({ params }) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "books" }],
            where: { fieldFilter: { field: { fieldPath: "slug" }, op: "EQUAL", value: { stringValue: params.slug } } },
            limit: 1,
          },
        }),
        next: { revalidate: 3600 },
      }
    );
    const data = await res.json();
    const fields = data[0]?.document?.fields;
    const title = fields?.title?.stringValue;
    const author = fields?.author?.stringValue || "";
    if (!title) return { title: "カタリバ" };
    const desc = `${author ? `${author}著「${title}」` : `「${title}」`}の読書討論ログ。みんなの感想・考察をまとめて読める。`;
    return {
      title: `${title} 討論ログ | カタリバ`,
      description: desc,
      openGraph: {
        title: `${title} 討論ログ`,
        description: desc,
        siteName: "カタリバ",
        type: "article",
      },
      twitter: {
        card: "summary",
        title: `${title} 討論ログ`,
        description: desc,
      },
    };
  } catch {
    return { title: "カタリバ" };
  }
}

export default function BookArchiveLayout({ children }) {
  return children;
}
