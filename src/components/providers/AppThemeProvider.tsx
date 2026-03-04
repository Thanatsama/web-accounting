"use client";

import { ThemeProvider, CssBaseline } from "@mui/material";
import type { ReactNode } from "react";
import { appTheme } from "@/theme/theme";

type AppThemeProviderProps = {
  children: ReactNode;
};

export default function AppThemeProvider({ children }: AppThemeProviderProps) {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
