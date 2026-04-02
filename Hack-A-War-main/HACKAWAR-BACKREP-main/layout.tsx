import React, { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: 'Aegis Migration Factory',
  description: 'Enterprise GenAI pipeline for GCP to AWS migration - HACK\'A\'WAR 2026',
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#0A0A0A" />
      </head>
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  )
}
