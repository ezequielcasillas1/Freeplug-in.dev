'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg border border-white/20 p-6',
          className
        )}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('mb-4', className)}
        {...props}
      />
    )
  }
)

CardHeader.displayName = 'CardHeader'

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn('text-xl font-bold text-gray-900', className)}
        {...props}
      />
    )
  }
)

CardTitle.displayName = 'CardTitle'

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('text-gray-600', className)}
        {...props}
      />
    )
  }
)

CardContent.displayName = 'CardContent'
