import { Moon, Sun, Circle, Contrast, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useThemeToggle, type Theme } from '@/hooks/useThemeToggle';
import { cn } from '@/lib/utils';

interface ThemeToggleButtonProps {
  className?: string;
}

const themeOptions = [
  { value: 'light', label: 'Original claro', Icon: Sun },
  { value: 'dark', label: 'Original escuro', Icon: Moon },
  { value: 'mono-light', label: 'Monocromático claro', Icon: Circle },
  { value: 'mono-dark', label: 'Monocromático escuro', Icon: Contrast },
] as const;

export default function ThemeToggleButton({ className }: ThemeToggleButtonProps) {
  const { theme, setTheme } = useThemeToggle();
  const activeOption = themeOptions.find((option) => option.value === theme) || themeOptions[0];
  const Icon = activeOption.Icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-9 w-9 rounded-xl text-muted-foreground hover:bg-muted/70 hover:text-foreground',
            className
          )}
          title={`Aparência: ${activeOption.label}`}
          aria-label={`Selecionar tema. Atual: ${activeOption.label}`}
        >
          <Icon className="h-[18px] w-[18px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-xl p-1.5">
        <DropdownMenuLabel className="px-2 py-2 text-xs">Aparência do JapanFlow</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={(next) => setTheme(next as Theme)}>
          {themeOptions.map(({ value, label, Icon: OptionIcon }) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              className="cursor-pointer rounded-lg py-2.5 pl-8 pr-2 text-xs"
            >
              <OptionIcon className="mr-2 h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {theme === value && <Check className="ml-2 h-3.5 w-3.5" aria-hidden="true" />}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
