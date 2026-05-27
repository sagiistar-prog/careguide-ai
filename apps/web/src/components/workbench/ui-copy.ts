import type { QueryResponse } from "./types";
import { translateMedicalTerms } from "./display-adapter";

export function statusLabel(status: QueryResponse["answer_status"]) {
  switch (status) {
    case "answered_with_evidence":
      return "已整理出用药卡片";
    case "needs_professional_confirmation":
      return "需要结合个人情况确认";
    case "blocked_high_risk":
      return "存在需要先处理的风险";
    case "insufficient_evidence":
      return "当前资料不足，暂不能确认";
  }
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

export function sourceTypeLabel(type: string) {
  const labels: Record<string, string> = {
    drug_label: "药品标签",
    drug_label_candidate: "药品标签候选资料",
    drug_product_metadata: "药品目录",
    drug_enforcement: "监管信息",
    patient_education: "患者教育",
    medical_book: "参考书籍",
    prescription_reference: "处方参考书籍",
  };

  return labels[type] ?? "来源资料";
}

export function scenarioTitle(key: string) {
  const labels: Record<string, string> = {
    cold_fever: "感冒发热",
    children_fever: "儿童退热",
    hypertension: "高血压",
    diabetes: "糖尿病",
  };

  return labels[key] ?? key;
}

export function displayMedicineText(value: string) {
  return translateMedicalTerms(value);
}
