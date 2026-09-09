import type { ButtonHTMLAttributes, ComponentType, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
export interface GeneratorControls {
    Panel: ComponentType<{
        children: ReactNode;
        className?: string;
    }>;
    Textarea: ComponentType<TextareaHTMLAttributes<HTMLTextAreaElement>>;
    Select: ComponentType<SelectHTMLAttributes<HTMLSelectElement>>;
    Button: ComponentType<ButtonHTMLAttributes<HTMLButtonElement>>;
}
/** Native controls by default; pass shared components from an existing design system. */
export default function MarkdownTableGenerator({ controls }: {
    controls?: Partial<GeneratorControls>;
}): import("react").JSX.Element;
