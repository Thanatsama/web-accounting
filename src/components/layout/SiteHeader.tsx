"use client";

import { useState } from "react";
import AppleIcon from "@mui/icons-material/Apple";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import Link from "next/link";
import map from "lodash/map";
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from "@mui/material";
import AccountBalanceMenu from "@/components/navigation/AccountBalanceMenu";

const links = [
  { label: "Home", path: "/" },
  { label: "Table", path: "/table" },
  { label: "Plan", path: "/plan" },
];

export default function SiteHeader() {
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(null);
  const isMobileMenuOpen = Boolean(mobileMenuAnchor);

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
        <Toolbar disableGutters sx={{ minHeight: 62, gap: { xs: 0.8, md: 2 } }}>
          <AppleIcon fontSize="small" />
          <Typography sx={{ fontWeight: 700, mr: 1, fontSize: { xs: "0.92rem", md: "1rem" }, whiteSpace: "nowrap" }}>
            Web Accounting
          </Typography>
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: { xs: 0.45, md: 1 } }}>
            <Box sx={{ display: { xs: "flex", md: "none" } }}>
              <IconButton
                size="small"
                aria-label="Open navigation menu"
                onClick={(event) => setMobileMenuAnchor(event.currentTarget)}
              >
                <MenuRoundedIcon fontSize="small" />
              </IconButton>
              <Menu
                anchorEl={mobileMenuAnchor}
                open={isMobileMenuOpen}
                onClose={() => setMobileMenuAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
              >
                {map(links, (link) => (
                  <MenuItem
                    key={`mobile-${link.path}`}
                    component={Link}
                    href={link.path}
                    onClick={() => setMobileMenuAnchor(null)}
                  >
                    {link.label}
                  </MenuItem>
                ))}
              </Menu>
            </Box>
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
