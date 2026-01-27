import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Content Stage",
  description: "Content staging and handover platform"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
