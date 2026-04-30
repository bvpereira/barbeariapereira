import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/colaborador')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/colaborador"!</div>
}
