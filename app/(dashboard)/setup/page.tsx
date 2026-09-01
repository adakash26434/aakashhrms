import { redirect } from 'next/navigation';

export default function SetupRootPage() {
  redirect('/setup/system-control');
}
