import { JobAnalysisDomainSignal } from "../domain/model.js";

const domainAliases: Record<string, string> = {
  "financial technology": "fintech",
  fintech: "fintech",
  "platform engineer": "platform engineering",
  "platform engineers": "platform engineering",
  "platform engineering": "platform engineering"
};

export function normalizeDomainValue(value: string): string {
  const normalized = value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
  return domainAliases[normalized] ?? normalized;
}

export function normalizeDomainSignal(signal: { sourceValue: string; sourceReference?: JobAnalysisDomainSignal["sourceReference"] }): JobAnalysisDomainSignal {
  return {
    canonicalValue: normalizeDomainValue(signal.sourceValue),
    sourceValue: signal.sourceValue,
    sourceReference: signal.sourceReference
  };
}
