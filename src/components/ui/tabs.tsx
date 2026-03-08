import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';

import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (node) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(node);
        return;
      }
      (ref as React.MutableRefObject<T | null>).current = node;
    });
  };
}

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const innerRef = React.useRef<React.ElementRef<typeof TabsPrimitive.List> | null>(null);
  const [indicatorStyle, setIndicatorStyle] = React.useState<{
    width: number;
    height: number;
    left: number;
    top: number;
    opacity: number;
  }>({
    width: 0,
    height: 0,
    left: 0,
    top: 0,
    opacity: 0,
  });

  React.useLayoutEffect(() => {
    const node = innerRef.current;
    if (!node) return;

    const updateIndicator = () => {
      const activeTrigger = node.querySelector<HTMLElement>('[data-state="active"]');
      if (!activeTrigger) {
        setIndicatorStyle((current) => ({ ...current, opacity: 0 }));
        return;
      }

      setIndicatorStyle({
        width: activeTrigger.offsetWidth,
        height: activeTrigger.offsetHeight,
        left: activeTrigger.offsetLeft,
        top: activeTrigger.offsetTop,
        opacity: 1,
      });
    };

    updateIndicator();

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(node);
    Array.from(node.children).forEach((child) => resizeObserver.observe(child));

    const mutationObserver = new MutationObserver(updateIndicator);
    mutationObserver.observe(node, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });

    window.addEventListener('resize', updateIndicator);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', updateIndicator);
    };
  }, [children]);

  return (
    <TabsPrimitive.List
      ref={mergeRefs(ref, innerRef)}
      className={cn(
        'relative inline-flex h-11 items-center justify-center rounded-[22px] border border-border/85 bg-secondary/92 p-1 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_24px_rgba(15,23,42,0.05)]',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute rounded-[18px] bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_12px_26px_rgba(15,23,42,0.1)] transition-[left,top,width,height,opacity] duration-300 ease-out"
        style={{
          width: indicatorStyle.width,
          height: indicatorStyle.height,
          left: indicatorStyle.left,
          top: indicatorStyle.top,
          opacity: indicatorStyle.opacity,
        }}
      />
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative z-[1] inline-flex items-center justify-center whitespace-nowrap rounded-[18px] px-4 py-2 text-sm font-medium transition-all outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-primary',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-2 outline-none', className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;
