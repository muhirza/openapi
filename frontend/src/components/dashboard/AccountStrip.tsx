import { BalanceCards } from '../BalanceCards';
import { TokenCard } from '../TokenCard';

export function AccountStrip() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="md:col-span-2">
        <BalanceCards compact />
      </div>
      <TokenCard compact />
    </div>
  );
}
