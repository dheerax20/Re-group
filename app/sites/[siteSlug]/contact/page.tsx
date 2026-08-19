import { notFound } from "next/navigation";
import { getPublishedSiteBySlug } from "@/lib/site/get-published-site";
import { BlockTree } from "@/components/website/blocks/block-renderer";
import type { BlockNode } from "@/lib/site/blocks/types";

export const revalidate = 300;

export default async function ContactPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const data = await getPublishedSiteBySlug(siteSlug);
  if (!data || !data.site.features.contact) notFound();

  const { site, content } = data;

  const blocks: BlockNode[] = [
    {
      id: "contact-page",
      type: "section",
      style: { padding: "lg", align: "center" },
      children: [
        { id: "contact-eyebrow", type: "eyebrow", text: "Get In Touch" },
        { id: "contact-heading", type: "heading", text: "Contact Us", scale: "h1" },
        { id: "contact-info", type: "contactInfo" },
        { id: "contact-social", type: "socialLinks" },
      ],
    },
  ];

  return <BlockTree nodes={blocks} site={site} content={content} />;
}
