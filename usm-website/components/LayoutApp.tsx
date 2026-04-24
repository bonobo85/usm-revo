import { Navbar } from './Navbar';

export function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-fond">
      <Navbar />
      <main className="max-w-[1600px] mx-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
