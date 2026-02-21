import { ReactNode } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
    return (
        <div
            className={cn("bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden", className)}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn("px-6 py-4 border-b border-gray-100", className)}>
            {children}
        </div>
    );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <h3 className={cn("text-lg font-semibold text-gray-900", className)}>
            {children}
        </h3>
    );
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn("px-6 py-4", className)}>
            {children}
        </div>
    );
}

export function Button({
    children,
    className,
    variant = 'primary',
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
    const variants = {
        primary: 'bg-red-600 text-white hover:bg-red-700',
        secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
        danger: 'bg-red-100 text-red-600 hover:bg-red-200',
        ghost: 'bg-transparent text-gray-500 hover:bg-gray-100',
    };

    return (
        <button
            className={cn(
                "px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50",
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}
