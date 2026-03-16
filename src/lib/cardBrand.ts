import { CARD_TYPE_OPTIONS, CardType } from "@/lib/budgetState";

export type CardTypeInput = "" | CardType;

type CardBrandMeta = {
  label: string;
  icon: string;
};

export const CARD_BRAND_META: Record<CardType, CardBrandMeta> = {
  JCB: { label: "JCB", icon: "/card-icons/jcb.png" },
  THE_1: { label: "The 1", icon: "/card-icons/the-1.png" },
  CARD_X: { label: "Card X", icon: "/card-icons/card-x.png" },
  FIRST_CHOICE: { label: "First Choice", icon: "/card-icons/first-choice.webp" },
  UOB_ONE: { label: "UOB One", icon: "/card-icons/uob-one.png" },
  SHOPPEE: { label: "Shopee", icon: "/card-icons/Shopee.png" },
};

export const CARD_TYPE_SELECT_OPTIONS: Array<{ value: CardTypeInput; label: string }> = [
  { value: "", label: "ไม่มี" },
  ...CARD_TYPE_OPTIONS,
];

export function getCardLabel(cardType?: CardType): string {
  if (!cardType) return "-";
  return CARD_BRAND_META[cardType].label;
}

export function getCardIcon(cardType?: CardType): string | null {
  if (!cardType) return null;
  return CARD_BRAND_META[cardType].icon;
}
