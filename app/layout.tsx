import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/header-auth";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { inter } from "@/components/typography/fonts";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import { EnvelopeIcon } from "@heroicons/react/24/outline";
import "./globals.css";
import Navigation from "@/components/navigation/navigation";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Cadence: Microlearning made easy!",
  description:
    "Supercharge your microlearning with byte-sized texts using Cadence!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="min-h-screen flex flex-col items-center">
            <div className="w-full h-full flex flex-col flex-grow justify-between xl:gap-20 gap-8 items-center">
              <nav className="w-full flex justify-between border-b border-b-foreground/10 h-16">
                <div className="w-full flex justify-between items-center p-3 px-5 text-sm">
                  <div className="flex gap-10 items-center font-semibold">
                    <Link href={"/"}>Cadence</Link>
                    <Navigation />
                  </div>
                  {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                </div>
              </nav>
              <div className="flex flex-row justify-between w-full h-full">
                <div className="w-full flex flex-row justify-around gap-20 p-7 sm:p-5">
                  {children}
                </div>
              </div>

              <footer className="w-full flex items-center justify-between border-t mx-auto text-center text-xs gap-8 py-16">
                <div className="w-full flex flex-row justify-start gap-4 md:gap-12 ml-4 md:ml-12">
                  <p>© 2024 Cadance</p>{" "}
                </div>
                <div className="w-full flex flex-col justify-around gap-4 mr-4 md:mr-12">
                  <div className="flex flex-col justify-between gap-2">
                    <div className="w-full flex flex-row justify-end">
                      For help, feedback, issues, chat, feature requests:
                    </div>
                    <div className="w-full flex flex-row justify-end">
                      📞/💬 +1-(310)-500-6711
                    </div>
                    <div className="w-full flex flex-row justify-end">
                      📧 surajvathsa@gmail.com
                    </div>
                  </div>
                </div>
              </footer>
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
