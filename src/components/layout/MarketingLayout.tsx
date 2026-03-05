import type { ReactNode } from "react";
import { Box } from "@mui/material";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

type MarketingLayoutProps = {
  children: ReactNode;
};

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <Box sx={{ minHeight: "100dvh" }}>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </Box>
  );
}
