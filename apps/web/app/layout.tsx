export const metadata = {
  title: "Forge — Supabase MCP assistant",
  description: "Debugging assistant with allowlisted MCP tools and RLS.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#0b0f14",
          color: "#e8eef5",
        }}
      >
        {children}
      </body>
    </html>
  );
}
