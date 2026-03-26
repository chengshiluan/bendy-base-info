import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard : Kanban'
};

export default function KanbanPage() {
  redirect('/dashboard/workspaces/kanban');
}
