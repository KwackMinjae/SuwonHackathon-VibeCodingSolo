import type { Todo } from '../types'

interface Props {
  todos: Todo[]
  onToggle: (id: number) => void
  onDelete: (id: number) => void
}

export default function TodoList({ todos, onToggle, onDelete }: Props) {
  if (todos.length === 0) {
    return <p className="empty">할 일이 없습니다.</p>
  }

  return (
    <ul className="todo-list">
      {todos.map(todo => (
        <li key={todo.id} className={todo.done ? 'done' : ''}>
          <span onClick={() => onToggle(todo.id)}>{todo.text}</span>
          <button onClick={() => onDelete(todo.id)}>삭제</button>
        </li>
      ))}
    </ul>
  )
}
