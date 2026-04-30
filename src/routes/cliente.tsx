import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/cliente')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/cliente"!</div>
}
