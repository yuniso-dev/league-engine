import AutoSignIn from './AutoSignIn';

// Sign-in entry for redirects that can't POST a server action (middleware,
// page guards). Sends the visitor straight to Discord's authorize screen.

type Props = { searchParams: { next?: string } };

export default function SignInPage({ searchParams }: Props) {
  const raw = searchParams.next ?? '/';
  // Same-origin paths only — never redirect off-site after sign-in.
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
  return <AutoSignIn next={next} />;
}
