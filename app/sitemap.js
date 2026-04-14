export const revalidate = 3600;

export default async function sitemap() {
  const baseUrl = (
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://tas-katariba.jp")
  ).trim().replace(/\/$/, "");

  const projectId = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "").trim();

  const staticRoutes = [
    { url: baseUrl, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/archive`, changeFrequency: "daily", priority: 0.8 },
  ];

  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/books?pageSize=200`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    const docs = data.documents || [];
    console.log("[sitemap] fetched books:", docs.length, "projectId:", projectId);

    const bookRoutes = docs
      .filter((d) => {
        const status = d.fields?.status?.stringValue;
        return status === "reading" || status === "open";
      })
      .map((d) => {
        const slug = d.fields?.slug?.stringValue || d.name.split("/").pop();
        return { url: `${baseUrl}/book/${slug}`, changeFrequency: "daily", priority: 0.9, lastModified: new Date() };
      });

    const archiveRoutes = docs
      .filter((d) => d.fields?.status?.stringValue === "closed")
      .map((d) => {
        const slug = d.fields?.slug?.stringValue || d.name.split("/").pop();
        return { url: `${baseUrl}/archive/${slug}`, changeFrequency: "weekly", priority: 0.7, lastModified: new Date() };
      });

    return [...staticRoutes, ...bookRoutes, ...archiveRoutes];
  } catch (e) {
    console.error("[sitemap] error:", e.message);
    return staticRoutes;
  }
}
