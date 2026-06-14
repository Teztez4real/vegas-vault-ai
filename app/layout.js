export const metadata = {
  title: 'Vegas Vault AI',
  description: 'Professional sports betting intelligence',
  icons: { icon: '/favicon.ico' },
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
        <link href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css" rel="stylesheet"/>
      </head>
      <body style={{ margin: 0, background: '#07091a' }}>
        {children}
      </body>
    </html>
  );
}
