import { Noto_Sans_JP, DM_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const notoSansJP = Noto_Sans_JP({
  weight: ["300", "400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-noto",
});

const dmSans = DM_Sans({
  weight: ["300", "400", "600"],
  subsets: ["latin"],
  variable: "--font-dm",
});

export const metadata = {
  title: "カタリバ",
  description: "言葉で、人を好きになる。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${dmSans.variable}`}>
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
