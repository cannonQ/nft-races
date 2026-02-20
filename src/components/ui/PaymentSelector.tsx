import { cn } from '@/lib/utils';
import type { PaymentCurrency, FeeToken } from '@/types/game';

interface PaymentSelectorProps {
  feeToken: FeeToken;
  ergAmount: string;
  tokenAmount: number;
  selected: PaymentCurrency;
  onSelect: (currency: PaymentCurrency) => void;
  className?: string;
}

export function PaymentSelector({
  feeToken,
  ergAmount,
  tokenAmount,
  selected,
  onSelect,
  className,
}: PaymentSelectorProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      <button
        type="button"
        onClick={() => onSelect('erg')}
        className={cn(
          'rounded-lg p-2.5 text-sm border transition-all text-center',
          selected === 'erg'
            ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
            : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/30',
        )}
      >
        <div className="font-mono font-semibold">{ergAmount} ERG</div>
      </button>
      <button
        type="button"
        onClick={() => onSelect('token')}
        className={cn(
          'rounded-lg p-2.5 text-sm border transition-all text-center',
          selected === 'token'
            ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
            : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/30',
        )}
      >
        <div className="font-mono font-semibold">
          {tokenAmount} {feeToken.name}
        </div>
      </button>
    </div>
  );
}
