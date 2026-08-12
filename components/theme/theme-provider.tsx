import { BrandConfig } from "@/lib/theme/types";
import { generateThemeStyle } from "@/lib/theme/generate-theme";

export function ThemeProvider({
  brand,
  children,
}: {
  brand: BrandConfig;
  children: React.ReactNode;
}) {
  return (
    <div style={generateThemeStyle(brand)} className="theme-root">
      {children}
    </div>
  );
}
