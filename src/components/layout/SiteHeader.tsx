"use client";

import AppleIcon from "@mui/icons-material/Apple";
import Link from "next/link";
import map from "lodash/map";
import { AppBar, Box, Button, Container, Toolbar, Typography } from "@mui/material";
import AccountBalanceMenu from "@/components/navigation/AccountBalanceMenu";

const links = [
  { label: "Home", path: "/" },
  { label: "Table", path: "/table" },
  { label: "Plan", path: "/plan" },
];

export default function SiteHeader() {
  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backdropFilter: "blur(16px)",
        backgroundColor: "rgba(255,255,255,0.72)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        color: "text.primary",
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ minHeight: 62, gap: 2 }}>
          <AppleIcon fontSize="small" />
          <Typography sx={{ fontWeight: 700, mr: 1 }}>Web Accounting</Typography>
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1 }}>
              {map(links, (link) => (
                <Button key={link.path} color="inherit" size="small" component={Link} href={link.path}>
                  {link.label}
                </Button>
              ))}
            </Box>
            <AccountBalanceMenu />
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
