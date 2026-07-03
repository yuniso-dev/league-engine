import { LoadingBolt } from '@/components/ui/LoadingBolt';

export default function RootLoading() {
  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(160deg, #09091f 0%, #04050c 55%, #0a0412 100%)' }}>
      <LoadingBolt accent="#FFD24A" />
    </div>
  );
}
