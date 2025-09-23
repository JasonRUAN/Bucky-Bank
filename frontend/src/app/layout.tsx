import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

import "@mysten/dapp-kit/dist/index.css";
import SuiDappProvider from "@/providers/SuiDappProvider";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "BuckyBank 存钱罐",
    description: "🐷✨ 超级可爱的小猪存钱罐！快来和Bucky一起存币，看着你的宝藏慢慢长大吧！💰🌟",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <SuiDappProvider>{children}</SuiDappProvider>

                <Toaster
                    position="bottom-center"
                    expand={true}
                    richColors={true}
                    closeButton={true}
                    toastOptions={{
                        style: {
                            background:
                                "linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%)",
                            border: "3px solid #fd79a8",
                            borderRadius: "20px",
                            fontSize: "16px",
                            fontWeight: "600",
                            padding: "16px 20px",
                            boxShadow: "0 10px 25px rgba(253, 121, 168, 0.3)",
                            minHeight: "70px",
                            minWidth: "350px",
                        },
                        className: "piggy-toast",
                        classNames: {
                            closeButton: "toast-close-no-animation"
                        }
                    }}
                />
            </body>
        </html>
    );
}
