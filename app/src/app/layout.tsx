import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Extended Savasana",
  description:
    "Customize the length of savasana in YouTube yoga videos. Stay in rest as long as you need.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased bg-[#faf8f5] dark:bg-[#1a1f1a] transition-colors duration-200">
        {/* Runs synchronously before paint to prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})()`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
