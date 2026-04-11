import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your spending, budget, and investments."
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            Charts and month totals will land here once the other CRUD slices
            and the categorizer are in place. Right now this page just verifies
            the shell renders correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Nav the sidebar to Categories to see the template CRUD in action.
        </CardContent>
      </Card>
    </div>
  );
}
