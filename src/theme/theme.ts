import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0071e3",
    },
    background: {
      default: "#f5f5f7",
      paper: "#ffffff",
    },
    text: {
      primary: "#1d1d1f",
      secondary: "#6e6e73",
    },
  },
  shape: {
    borderRadius: 20,
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontWeight: 700,
      letterSpacing: "-0.03em",
    },
    h2: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontWeight: 600,
      letterSpacing: "-0.02em",
    },
    h3: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontWeight: 600,
      letterSpacing: "-0.015em",
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: "1.25rem",
          paddingBlock: "0.6rem",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          paddingTop: "1.35rem",
          paddingInline: "1.4rem",
          paddingBottom: "0.7rem",
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          paddingInline: "1.4rem",
          paddingBottom: "1.25rem",
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        size: "small",
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#657286",
          fontSize: "0.92rem",
          fontWeight: 600,
          letterSpacing: "-0.01em",
        },
        shrink: {
          color: "#4f5d73",
          backgroundColor: "#ffffff",
          paddingInline: "0.38rem",
          borderRadius: "999px",
          transform: "translate(14px, -10px) scale(0.84)",
          boxShadow: "0 0 0 4px rgba(255,255,255,0.96)",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          background: "linear-gradient(180deg, #fcfdff, #f7faff)",
          transition: "box-shadow 140ms ease, border-color 140ms ease, transform 140ms ease",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(117, 130, 150, 0.26)",
            borderWidth: 1,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(0, 113, 227, 0.32)",
          },
          "&.Mui-focused": {
            boxShadow: "0 0 0 4px rgba(0, 113, 227, 0.10)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#0071e3",
            borderWidth: 1.5,
          },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: "#d14343",
          },
        },
        input: {
          paddingTop: "0.95rem",
          paddingBottom: "0.95rem",
          fontSize: "1.02rem",
          color: "#1f2633",
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginLeft: "0.2rem",
          marginTop: "0.45rem",
          color: "#7a8799",
          fontSize: "0.76rem",
          lineHeight: 1.35,
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          display: "flex",
          alignItems: "center",
          minHeight: "1.25rem",
        },
        icon: {
          color: "#62728a",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          marginInline: 6,
          marginBlock: 2,
          minHeight: 38,
          fontSize: "0.95rem",
          "&.Mui-selected": {
            backgroundColor: "rgba(0, 113, 227, 0.10)",
          },
          "&.Mui-selected:hover": {
            backgroundColor: "rgba(0, 113, 227, 0.14)",
          },
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: 18,
          border: "1px solid rgba(26, 35, 52, 0.08)",
          boxShadow: "0 18px 42px rgba(17, 31, 54, 0.18)",
        },
      },
    },
  },
});
