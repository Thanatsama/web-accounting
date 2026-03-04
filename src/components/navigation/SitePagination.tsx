"use client";

import { usePathname, useRouter } from "next/navigation";
import { Pagination, Stack, Typography } from "@mui/material";
import type { ChangeEvent } from "react";
import { indexToPage, pageToIndex, SITE_PAGES } from "@/lib/sitePages";

export default function SitePagination() {
  const router = useRouter();
  const pathname = usePathname();
  const currentPage = pageToIndex(pathname);

  const handlePageChange = (_event: ChangeEvent<unknown>, page: number) => {
    router.push(indexToPage(page).path);
  };

  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }}>
      <Pagination
        count={SITE_PAGES.length}
        page={currentPage}
        shape="rounded"
        color="primary"
        onChange={handlePageChange}
      />
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Page {currentPage} of {SITE_PAGES.length}
      </Typography>
    </Stack>
  );
}
