export type SitePage = {
  title: string;
  path: string;
};

export const SITE_PAGES: SitePage[] = [
  { title: "Overview", path: "/" },
  { title: "Features", path: "/features" },
  { title: "Pricing", path: "/pricing" },
];

export function pageToIndex(pathname: string): number {
  const index = SITE_PAGES.findIndex((item) => item.path === pathname);
  return index === -1 ? 1 : index + 1;
}

export function indexToPage(page: number): SitePage {
  return SITE_PAGES[Math.max(0, Math.min(SITE_PAGES.length - 1, page - 1))];
}
