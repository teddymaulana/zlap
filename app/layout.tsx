import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono, Anton } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import Nav from "./Nav";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Single-weight display font used for the /sets/jp set-code chip and title.
const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "zlap-erp",
  description: "Internal inventory, purchases, and order tracking",
};

// Fixed light design, no dark variant — see the color-scheme comment in
// app/globals.css for why this matters on a dark-style phone browser.
export const viewport: Viewport = {
  colorScheme: "light",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {user && <Nav />}
        {children}
      </body>
    </html>
  );
}
