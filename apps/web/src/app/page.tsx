import { getRankings, getTournaments } from '@inazuma/db';
import StormShell from '@/components/StormShell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  const [rankings, tournaments] = await Promise.all([
    getRankings(),
    getTournaments(),
  ]);

  return <StormShell rankings={rankings} tournaments={tournaments} />;
}
