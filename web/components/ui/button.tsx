import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-sm border font-sans font-medium whitespace-nowrap transition-[color,background-color,border-color,opacity,transform] duration-150 ease-out outline-none select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground hover:bg-ink hover:border-ink",
        outline: "border-ink bg-transparent text-ink hover:bg-paper-2",
      },
      size: {
        default: "h-11 px-5 text-[0.9375rem]",
        sm: "h-11 px-4 text-[0.875rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
