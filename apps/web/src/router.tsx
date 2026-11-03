import { createBrowserRouter, Navigate } from 'react-router';

import { RequireAuth } from '@/components/require-auth';
import { Login } from '@/routes/login';
import { Register } from '@/routes/register';
import { Account } from '@/routes/account';
import { GroupList } from '@/routes/groups/list';
import { CreateGroup } from '@/routes/groups/create';
import { JoinGroup } from '@/routes/groups/join';
import { GroupDetail } from '@/routes/groups/detail';
import { ExpenseForm } from '@/routes/groups/expense-form';
import { ExpenseDetail } from '@/routes/groups/expense-detail';
import { Settlements } from '@/routes/groups/settlements';
import { Participants } from '@/routes/groups/participants';
import { Filters } from '@/routes/groups/filters';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/registro', element: <Register /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <Navigate to="/grupos" replace /> },
      { path: '/cuenta', element: <Account /> },
      { path: '/grupos', element: <GroupList /> },
      { path: '/grupos/crear', element: <CreateGroup /> },
      { path: '/grupos/unirme', element: <JoinGroup /> },
      { path: '/grupos/:groupId', element: <GroupDetail /> },
      { path: '/grupos/:groupId/gastos/nuevo', element: <ExpenseForm /> },
      { path: '/grupos/:groupId/gastos/:expenseId', element: <ExpenseDetail /> },
      { path: '/grupos/:groupId/gastos/:expenseId/editar', element: <ExpenseForm /> },
      { path: '/grupos/:groupId/pagos', element: <Settlements /> },
      { path: '/grupos/:groupId/participantes', element: <Participants /> },
      { path: '/grupos/:groupId/filtros', element: <Filters /> },
    ],
  },
]);
