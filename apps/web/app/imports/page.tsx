import { ImportView } from './import-view';

export const metadata = {
  title: 'Imports — Cluster Resolve',
  description: 'Upload and process procurement data files directly into Supabase Storage and database.',
};

export default function ImportsPage() {
  return <ImportView />;
}
