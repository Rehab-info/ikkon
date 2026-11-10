import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { SessionProvider, useSession } from '@/lib/session.tsx';
import { decideGate } from '@/lib/route.ts';
import { AppShell } from '@/components/AppShell.tsx';
import { Loading } from '@/components/ErrorNotice.tsx';
import { LoginPage } from '@/features/auth/LoginPage.tsx';
import { MfaPage } from '@/features/auth/MfaPage.tsx';
import { OnboardingPage } from '@/features/auth/OnboardingPage.tsx';
import { NotRegisteredPage } from '@/features/auth/NotRegisteredPage.tsx';
import { HomePage } from '@/features/member/HomePage.tsx';
import { ConsentPage } from '@/features/consent/ConsentPage.tsx';
import { SettingsPage } from '@/features/profile/SettingsPage.tsx';
import { StaffDashboardPage } from '@/features/staff/StaffDashboardPage.tsx';
import { AdminUsersPage } from '@/features/admin/AdminUsersPage.tsx';
import { AdminAssignmentsPage } from '@/features/admin/AdminAssignmentsPage.tsx';
import { RecordMealPage } from '@/features/meals/RecordMealPage.tsx';
import { MealDetailPage } from '@/features/meals/MealDetailPage.tsx';
import { MealHistoryPage } from '@/features/meals/MealHistoryPage.tsx';

function Gate() {
  const { loading, session, context } = useSession();
  const gate = decideGate({ loading, signedIn: session !== null, context });

  switch (gate.kind) {
    case 'loading':
      return <Loading />;
    case 'login':
      return <LoginPage />;
    case 'not_registered':
      return <NotRegisteredPage />;
    case 'mfa':
      return <MfaPage />;
    case 'onboarding':
      return <OnboardingPage />;
    case 'ready': {
      const has = (r: 'member' | 'staff' | 'admin') => gate.roles.includes(r);
      return (
        <AppShell roles={gate.roles}>
          <Routes>
            {has('member') && <Route path="/" element={<HomePage />} />}
            {has('member') && <Route path="/sharing" element={<ConsentPage />} />}
            {has('member') && <Route path="/meals" element={<MealHistoryPage />} />}
            {has('member') && <Route path="/meals/new" element={<RecordMealPage />} />}
            {(has('member') || has('staff')) && <Route path="/meals/:mealId" element={<MealDetailPage />} />}
            {has('staff') && <Route path="/staff" element={<StaffDashboardPage />} />}
            {has('staff') && <Route path="/members/:memberId/meals" element={<MealHistoryPage />} />}
            {has('staff') && <Route path="/members/:memberId/meals/new" element={<RecordMealPage />} />}
            {has('admin') && <Route path="/admin" element={<AdminUsersPage />} />}
            {has('admin') && <Route path="/admin/assignments" element={<AdminAssignmentsPage />} />}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to={gate.home} replace />} />
          </Routes>
        </AppShell>
      );
    }
  }
}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </SessionProvider>
  );
}
