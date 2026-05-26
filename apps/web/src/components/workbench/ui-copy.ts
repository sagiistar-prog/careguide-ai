import type { QueryResponse } from "./types";

export function statusLabel(status: QueryResponse["answer_status"]) {
  switch (status) {
    case "answered_with_evidence":
      return "已整理出可查看的资料";
    case "needs_professional_confirmation":
      return "需要结合个人情况确认";
    case "blocked_high_risk":
      return "这个问题需要先处理安全风险";
    case "insufficient_evidence":
      return "当前资料不足，暂不能确认";
  }
}

export function statusTone(status: QueryResponse["answer_status"]) {
  if (status === "answered_with_evidence") {
    return "steady";
  }

  if (
    status === "needs_professional_confirmation" ||
    status === "blocked_high_risk"
  ) {
    return "attention";
  }

  return "empty";
}

export function confidenceLabel(confidence: "high" | "medium" | "low") {
  switch (confidence) {
    case "high":
      return "较高";
    case "medium":
      return "中等";
    case "low":
      return "较低";
  }
}

export function sourceTypeLabel(type: string) {
  const labels: Record<string, string> = {
    drug_label: "药品说明资料",
    drug_label_candidate: "药品标签候选资料",
    drug_product_metadata: "药品产品资料",
    drug_enforcement: "召回或监管资料",
    patient_education: "患者教育资料",
    medical_book: "参考书籍",
    prescription_reference: "处方参考书籍",
  };

  return labels[type] ?? "来源资料";
}

export function scenarioTitle(key: string) {
  const labels: Record<string, string> = {
    cold_fever: "感冒发热",
    children_fever: "儿童退烧",
    hypertension: "高血压",
    diabetes: "糖尿病",
  };

  return labels[key] ?? key;
}

const DRUG_NAME_LABELS: Record<string, string> = {
  acetaminophen: "对乙酰氨基酚",
  paracetamol: "对乙酰氨基酚",
  ibuprofen: "布洛芬",
  metformin: "二甲双胍",
  amlodipine: "氨氯地平",
  lisinopril: "赖诺普利",
};

export function displayMedicineText(value: string) {
  return Object.entries(DRUG_NAME_LABELS).reduce((text, [english, chinese]) => {
    const pattern = new RegExp(`\\b${english}\\b`, "gi");
    return text.replace(pattern, `${chinese}（${english}）`);
  }, value);
}
