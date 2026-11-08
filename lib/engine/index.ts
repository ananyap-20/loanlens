export * from "./types";
export { parseAmounts, type ParsedAmount } from "./parseAmounts";
export { extractClaims, detectFrequency, isUncertain, hasConsequenceKeyword } from "./extractClaims";
export { compare, compareField, type FieldComparison, type SideComparison } from "./compare";
export {
  numberToHindiWords,
  decimalToHindiWords,
  rupeesToHindi,
  percentToHindi,
  monthsToHindi,
  weeksToHindi,
  toSpeakableText,
} from "./hindiNumbers";
export * from "./gate";
