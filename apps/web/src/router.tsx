import { createBrowserRouter, Navigate, Outlet } from 'react-router';

import { AnimatedLayout } from '@/components/animated-layout';
import { AppShell } from '@/components/app-shell';
import { RequireAuth } from '@/components/require-auth';
import { RouteError } from '@/components/route-error';
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
import { Categories } from '@/routes/groups/categories';
import { Participants } from '@/routes/groups/participants';
import { Filters } from '@/routes/groups/filters';

export const router = createBrowserRouter([
  {
    element: <Outlet />,
    errorElement: <RouteError />,
    children: [
      // Login and register: full screen, no app frame.
      {
        element: <AnimatedLayout />,
        children: [
          { path: '/login', element: <Login /> },
          { path: '/registro', element: <Register /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            // Sidebar (compu) / header (celu), with the screen animated inside.
            element: <AppShell />,
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
              { path: '/grupos/:groupId/categorias', element: <Categories /> },
              { path: '/grupos/:groupId/filtros', element: <Filters /> },
            ],
          },
        ],
      },
    ],
  },
]);
