import { ApplicationProvider } from "@/context/ApplicationContext";
import AppShell from "@/components/AppShell";

export default function Home() {
  return (
    <ApplicationProvider>
      <AppShell />
    </ApplicationProvider>
  );
}
