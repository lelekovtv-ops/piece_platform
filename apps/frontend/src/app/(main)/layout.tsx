import { DevInspector } from "@/components/app/DevInspector";
import { GlobalNav } from "@/components/app/GlobalNav";
import { MainContent } from "@/components/app/MainContent";
import { LockBanner } from "@/components/app/LockBanner";

export default function MainGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <GlobalNav />
      <MainContent>
        {children}
      </MainContent>
      <LockBanner />
      <DevInspector />
    </>
  );
}
