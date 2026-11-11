import { createBrowserRouter, Outlet } from 'react-router';

import { AnimatedLayout } from '@/components/animated-layout';
import { AppShell } from '@/components/app-shell';
import { RequireAuth } from '@/components/require-auth';
import { NotFound } from '@/components/not-found';
import { RouteError } from '@/components/route-error';
import { Login } from '@/routes/login';
import { Register } from '@/routes/register';
import { ForgotPassword } from '@/routes/forgot-password';
import { NewPassword } from '@/routes/new-password';
import { ChangeEmail } from '@/routes/change-email';
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
import { AfterGoogle } from '@/components/after-google';
import { withViewTransitions } from '@/lib/screen-transitions';

export const router = createBrowserRouter([
  {
    element: <Outlet />,
    errorElement: <RouteError />,
    children: [
      // Login, register, password recovery and the email-change links: full screen, no app frame.
      {
        element: <AnimatedLayout />,
        children: [
          { path: '/login', element: <Login /> },
          { path: '/registro', element: <Register /> },
          { path: '/recuperar-contrasena', element: <ForgotPassword /> },
          { path: '/nueva-contrasena', element: <NewPassword /> },
          { path: '/cambiar-email', element: <ChangeEmail /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            // Sidebar (compu) / header (celu), with the screen animated inside.
            element: <AppShell />,
            children: [
              { path: '/', element: <AfterGoogle /> },
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
      // Any other URL (an old or mistyped link): "Esta página no existe", not a crash to report.
      { path: '*', element: <NotFound /> },
    ],
  },
]);

// Screen changes animated with the View Transitions API (src/lib/screen-transitions.ts).
withViewTransitions(router);
