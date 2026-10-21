export const seo = (title: string, description: string) => ({
  meta: [
    { title: `${title} — SignalDesk` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — SignalDesk` },
    { property: "og:description", content: description },
  ],
});
