import MigrationDashboard from "@/components/migration/MigrationDashboard";

export const metadata = {
  title: "Dashboard | Aegis Migration Factory",
  description:
    "Upload GCP infrastructure files and watch the 5-agent AI pipeline migrate them to AWS in real-time.",
};

import { Navbar } from "@/components/navbar";

export default function DashboardPage() {
  return (
    <>
      <Navbar />
      <MigrationDashboard />
    </>
  );
}
