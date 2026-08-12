export interface BrandConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    foreground: string;
    accent: string;
  };

  typography: {
    primaryFont: string;
    secondaryFont: string;
  };

  logo: {
    url: string;
    alt: string;
  };

  favicon: {
    url: string;
  };

  tagline?: string;
}
