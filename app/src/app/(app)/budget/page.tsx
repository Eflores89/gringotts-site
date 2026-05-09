import { PageHeader } from "@/components/common/PageHeader";
import { BudgetTabs } from "./tabs";

export default function BudgetPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        description="Planned spend by category and planned income."
      />
      <BudgetTabs />
    </div>
  );
}
