import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "AuraGen | Financial Application Portal",
  description: "Apply for financial products with AuraGen.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={figtree.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
