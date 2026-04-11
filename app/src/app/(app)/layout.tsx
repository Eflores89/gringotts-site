import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Shell } from "@/components/shell/Shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }
  return <Shell>{children}</Shell>;
}
