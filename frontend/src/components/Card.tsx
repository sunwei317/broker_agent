import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

export default function Card({ children, className = '', hover = false, onClick }: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { scale: 1.02, y: -2 } : undefined}
      whileTap={hover ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={`
        glass rounded-2xl p-6
        ${hover ? 'cursor-pointer transition-shadow hover:shadow-lg hover:shadow-gold-500/10' : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  )
}

