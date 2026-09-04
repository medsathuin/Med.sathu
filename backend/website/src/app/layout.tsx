import type { Metadata } from 'next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Medsathu.inn - Medical Learning Platform',
  description: 'All-in-one medical learning platform for MBBS students & teachers with video lectures, QBank, notes, flashcards, and AI tutor.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}