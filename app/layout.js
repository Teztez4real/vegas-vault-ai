export const metadata = {
  title: 'Vegas Vault AI',
  description: 'Professional sports betting intelligence',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap" rel="stylesheet"/>
      </head>
      <body style={{ margin: 0, padding: 0, background: '#07091a' }}>
        {children}
      </body>
    </html>
  );
}
