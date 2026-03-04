import { Box, Container, Typography } from "@mui/material";
import MarketingLayout from "@/components/layout/MarketingLayout";
import styles from "./page.module.css";

const features = [
  {
    title: "Automated Invoicing",
    description: "Generate branded invoices and automatic follow-ups in seconds.",
  },
  {
    title: "Expense Intelligence",
    description: "Classify spend from receipts and bank feeds with less manual tagging.",
  },
  {
    title: "Real-time Reconciliation",
    description: "Match transactions continuously to keep books always close-ready.",
  },
  {
    title: "Cash Forecast",
    description: "Simulate cash flow for the next 90 days before making key decisions.",
  },
];

export default function FeaturesPage() {
  return (
    <MarketingLayout>
      <Container maxWidth="lg" className={styles.wrapper}>
        <Typography variant="h1" className={styles.title}>
          Features
        </Typography>
        <Typography className={styles.subtitle}>
          Every tool your finance team needs, presented with a focused interface and predictable workflows.
        </Typography>
        <Box className={styles.grid}>
          {features.map((feature) => (
            <article key={feature.title} className={styles.card}>
              <Typography variant="h3" className={styles.cardTitle}>
                {feature.title}
              </Typography>
              <Typography className={styles.cardDescription}>{feature.description}</Typography>
            </article>
          ))}
        </Box>
      </Container>
    </MarketingLayout>
  );
}
