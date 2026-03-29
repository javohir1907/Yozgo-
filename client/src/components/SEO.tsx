import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

export const SEO = ({
  title = "YOZGO | O'zbekiston tez yozish va musobaqalar platformasi",
  description = "YOZGO - O'zbekistondagi eng yirik tez yozish platformasi. Musobaqalarda qatnashing va mahoratingizni oshiring.",
  image = "https://yozgo.uz/og-image.png",
  url = "https://yozgo.uz",
  type = "website",
}: SEOProps) => {
  const siteTitle = title.includes("YOZGO") ? title : `${title} | YOZGO`;

  return (
    <Helmet>
      {/* Standart Meta Teglar */}
      <title>{siteTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* Facebook Meta Teglar (Open Graph) */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />

      {/* Twitter Meta Teglar */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Telegram uchun qo'shimcha */}
      <meta property="og:site_name" content="YOZGO" />
    </Helmet>
  );
};

export default SEO;
