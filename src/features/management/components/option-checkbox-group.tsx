'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { OptionItem } from '@/lib/platform/types';

interface OptionCheckboxGroupProps {
  options: OptionItem[];
  value: string[];
  onChange: (value: string[]) => void;
  emptyLabel?: string;
  heightClassName?: string;
}

export function OptionCheckboxGroup({
  options,
  value,
  onChange,
  emptyLabel = '暂无可选项。',
  heightClassName = 'h-48'
}: OptionCheckboxGroupProps) {
  if (!options.length) {
    return (
      <div className='text-muted-foreground rounded-md border border-dashed p-3 text-sm'>
        {emptyLabel}
      </div>
    );
  }

  return (
    <ScrollArea className={`rounded-md border ${heightClassName}`}>
      <div className='space-y-2 p-3'>
        {options.map((option) => {
          const checked = value.includes(option.value);

          return (
            <label
              key={option.value}
              className='hover:bg-muted/40 flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm'
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(nextChecked) => {
                  if (nextChecked) {
                    onChange([...value, option.value]);
                    return;
                  }

                  onChange(value.filter((item) => item !== option.value));
                }}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </ScrollArea>
  );
}
