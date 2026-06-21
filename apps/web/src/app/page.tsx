import { getRankings, getTournaments } from '@inazuma/db';
import StormShell from '@/components/StormShell';

export default async function HomePage() {
  const [rankings, tournaments] = await Promise.all([
    getRankings(),
    getTournaments(),
  ]);

  return <StormShell rankings={rankings} tournaments={tournaments} />;
}
