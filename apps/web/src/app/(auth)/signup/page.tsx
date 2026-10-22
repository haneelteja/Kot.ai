import dynamic from 'next/dynamic';

const SignupForm = dynamic(() => import('@/components/signup-form'), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-sunken" />,
});

export default function SignupPage() {
  return <SignupForm />;
}
