import { Box, Container, Divider, Stack, Typography } from "@mui/material";

export default function SiteFooter() {
  return (
    <Box component="footer" sx={{ pb: 5 }}>
      <Container maxWidth="lg">
        <Divider sx={{ mb: 3 }} />
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Copyright 2026 Web Accounting Co.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Privacy · Terms · Contact
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
