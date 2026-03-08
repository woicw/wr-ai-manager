import * as SwitchPrimitives from '@radix-ui/react-switch';
import * as React from 'react';

import { cn } from '@/lib/utils';

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-black/12 bg-[linear-gradient(135deg,rgba(214,221,232,0.95),rgba(193,202,217,0.92))] transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(78,88,109,0.95),rgba(60,69,89,0.92))] data-[state=checked]:border-primary/55 data-[state=checked]:bg-[linear-gradient(135deg,rgba(69,124,255,0.98),rgba(73,178,255,0.94))] data-[state=checked]:shadow-[0_10px_20px_rgba(31,104,255,0.28)] dark:data-[state=checked]:border-sky-300/24 dark:data-[state=checked]:bg-[linear-gradient(135deg,rgba(86,142,255,0.98),rgba(80,190,255,0.94))]',
      className,
    )}
    {...props}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-6 w-6 rounded-full bg-white shadow-[0_4px_10px_rgba(15,23,42,0.16)] ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5',
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;
