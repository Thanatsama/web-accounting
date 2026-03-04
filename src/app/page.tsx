import { Box, Button, Container, Stack, Typography } from "@mui/material";
import MarketingLayout from "@/components/layout/MarketingLayout";
import styles from "./page.module.css";

export default function Home() {
  return (
    <MarketingLayout>
      <Box className={styles.hero}>
        <Container maxWidth="lg">
          <Stack spacing={3} className={styles.heroContent}>
            <Typography className={styles.eyebrow}>New • Smart Ledger</Typography>
            <Typography variant="h1" className={styles.title}>
              Accounting that feels as fluid as Apple-like product experience.
            </Typography>
            <Typography className={styles.subtitle}>
              Move from expense to insight in one clean flow, with no clutter and no learning curve.
            </Typography>
            <Stack direction="row" spacing={2} className={styles.actionRow}>
              <Button variant="contained">Start trial</Button>
              <Button variant="outlined">Watch demo</Button>
            </Stack>
          </Stack>
        </Container>
      </Box>
      <Container maxWidth="lg" className={styles.highlights}>
        <Box className={styles.highlightCard}>
          <Typography variant="h3">42%</Typography>
          <Typography>Faster month-end close</Typography>
        </Box>
        <Box className={styles.highlightCard}>
          <Typography variant="h3">2.1x</Typography>
          <Typography>Invoices paid sooner</Typography>
        </Box>
        <Box className={styles.highlightCard}>
          <Typography variant="h3">68%</Typography>
          <Typography>Less manual work</Typography>
        </Box>
      </Container>
    </MarketingLayout>
  );
}
