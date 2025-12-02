import "./globals.css";
import React from "react";

export const metadata = {
  title: "Paramount Demo - Video Intelligence",
  description: "Search, summarize, and detect product placements in videos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


