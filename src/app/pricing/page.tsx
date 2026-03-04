import { Box, Button, Container, Typography } from "@mui/material";
import MarketingLayout from "@/components/layout/MarketingLayout";
import styles from "./page.module.css";

const plans = [
  { name: "Starter", price: "$19", note: "For solo founders and freelancers." },
  { name: "Growth", price: "$49", note: "For growing teams with shared workflows." },
  { name: "Scale", price: "$99", note: "For finance teams needing advanced controls." },
];

export default function PricingPage() {
  return (
    <MarketingLayout>
      <Container maxWidth="lg" className={styles.wrapper}>
        <Typography variant="h1" className={styles.title}>
          Pricing
        </Typography>
        <Typography className={styles.subtitle}>Simple plans. No hidden fees. Upgrade any time.</Typography>
        <Box className={styles.grid}>
          {plans.map((plan) => (
            <article key={plan.name} className={styles.card}>
              <Typography className={styles.planName}>{plan.name}</Typography>
              <Typography className={styles.price}>{plan.price}</Typography>
              <Typography className={styles.note}>{plan.note}</Typography>
              <Button variant="contained">Choose {plan.name}</Button>
            </article>
          ))}
        </Box>
      </Container>
    </MarketingLayout>
  );
}
