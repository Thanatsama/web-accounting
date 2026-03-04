import type { ReactNode } from "react";
import { Box } from "@mui/material";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import SitePagination from "@/components/navigation/SitePagination";

type MarketingLayoutProps = {
  children: ReactNode;
};

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <Box sx={{ minHeight: "100dvh" }}>
      <SiteHeader />
      <main>{children}</main>
      <SitePagination />
      <SiteFooter />
    </Box>
  );
}
