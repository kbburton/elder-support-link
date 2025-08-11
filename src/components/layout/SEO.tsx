import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description?: string;
  canonicalPath?: string;
}

const SEO = ({ title, description, canonicalPath = "/" }: SEOProps) => {
  const canonical = typeof window !== "undefined" ? `${window.location.origin}${canonicalPath}` : canonicalPath;
  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={canonical} />
    </Helmet>
  );
};

export default SEO;
