import { Helmet } from 'react-helmet-async';
import { SEO_CONFIG, PAGE_SEO } from '../lib/seo';
import React from 'react';

interface SEOProps {
  page: string;
  customTitle?: string;
  customDescription?: string;
  customImage?: string;
}

export function SEO({ page, customTitle, customDescription, customImage }: SEOProps) {
  const pageSeo = PAGE_SEO[page] || {};
  const title = customTitle || pageSeo.title || SEO_CONFIG.defaultTitle;
  const description = customDescription || pageSeo.description || SEO_CONFIG.defaultDescription;
  const image = customImage || SEO_CONFIG.ogImage;
  const canonical = pageSeo.canonical || SEO_CONFIG.siteUrl;

  return (
    <Helmet>
      {/* Basic */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={(pageSeo.keywords || SEO_CONFIG.defaultKeywords).join(', ')} />
      <link rel="canonical" href={canonical} />
      {pageSeo.noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SEO_CONFIG.siteName} />
      <meta property="og:locale" content="en_IN" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={SEO_CONFIG.twitterHandle} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* India-specific */}
      <meta name="geo.region" content="IN" />
      <meta name="geo.country" content="India" />
      <meta name="language" content="English, Hindi, Urdu" />
      <meta name="target" content="all" />
      <meta name="audience" content="all" />
      <meta name="rating" content="general" />

      {/* Alternate URLs */}
      <link rel="alternate" hrefLang="en" href={`https://yourcaptions.com${typeof window !== 'undefined' ? window.location.pathname : ''}`} />
      <link rel="alternate" hrefLang="en-IN" href={`https://yourcaptions.in${typeof window !== 'undefined' ? window.location.pathname : ''}`} />
      <link rel="alternate" hrefLang="hi" href={`https://yourcaptions.in${typeof window !== 'undefined' ? window.location.pathname : ''}`} />
      <link rel="alternate" hrefLang="x-default" href={`https://yourcaptions.com${typeof window !== 'undefined' ? window.location.pathname : ''}`} />
    </Helmet>
  );
}
