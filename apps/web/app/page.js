 import { ApplicationProvider } from "@/context/ApplicationContext";
 import { FrictionProvider } from "@/context/FrictionContext";
 import AppShell from "@/components/AppShell";

 export default function Home() {
   return (
     <ApplicationProvider>
      <FrictionProvider>
        <AppShell />
      </FrictionProvider>
     </ApplicationProvider>
   );
 }