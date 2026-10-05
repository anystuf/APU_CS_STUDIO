import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './features/auth/AuthProvider'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { AppLayout } from './layouts/AppLayout'
import { HomePage, Placeholder, StudentDashboard, TeacherDashboard } from './pages/Dashboards'
import { LoginPage } from './pages/LoginPage'
import { TeacherCoursesPage } from './pages/TeacherCoursesPage'
import { TeacherCoursePage } from './pages/TeacherCoursePage'
import { TeacherSubmissionsPage } from './pages/TeacherSubmissionsPage'

const StudentCoursePage = lazy(() => import('./pages/StudentLearningPage').then(module => ({ default: module.StudentCoursePage })))
const PythonActivityPage = lazy(() => import('./pages/StudentLearningPage').then(module => ({ default: module.PythonActivityPage })))
const PythonIdePage = lazy(() => import('./pages/PythonIdePage').then(module => ({ default: module.PythonIdePage })))
const AssessmentsPage = lazy(() => import('./pages/AssessmentsPage').then(module => ({ default: module.AssessmentsPage })))
const AssessmentBuilderPage = lazy(() => import('./pages/AssessmentBuilderPage').then(module => ({ default: module.AssessmentBuilderPage })))
const AssessmentWorkspacePage = lazy(() => import('./pages/AssessmentWorkspacePage').then(module => ({ default: module.AssessmentWorkspacePage })))
const AssessmentReviewPage = lazy(() => import('./pages/AssessmentReviewPage').then(module => ({ default: module.AssessmentReviewPage })))

export default function App() {
  return <HashRouter><AuthProvider><Suspense fallback={<main className="center"><p>Loading classroom…</p></main>}><ClassroomRoutes/></Suspense></AuthProvider></HashRouter>
}

function ClassroomRoutes() {
  const { recovering } = useAuth()
  if (recovering) return <ResetPasswordPage/>
  return <Routes>
    <Route path="/login" element={<LoginPage/>}/>
    <Route element={<ProtectedRoute/>}><Route element={<AppLayout/>}>
      <Route index element={<HomePage/>}/><Route path="python-ide" element={<PythonIdePage/>}/>
      <Route path="assessments" element={<AssessmentsPage/>}/>
      <Route path="assessments/:assessmentId" element={<AssessmentWorkspacePage/>}/>
      <Route element={<ProtectedRoute roles={['student']}/>}><Route path="student" element={<StudentDashboard/>}/><Route path="student/course/:courseId" element={<StudentCoursePage/>}/><Route path="student/activity/:activityId" element={<PythonActivityPage/>}/></Route>
      <Route element={<ProtectedRoute roles={['teacher','admin']}/>}>
        <Route path="assessments/new" element={<AssessmentBuilderPage/>}/>
        <Route path="assessments/:assessmentId/edit" element={<AssessmentBuilderPage/>}/>
        <Route path="assessments/:assessmentId/review" element={<AssessmentReviewPage/>}/>
        <Route path="teacher" element={<TeacherDashboard/>}/><Route path="teacher/courses" element={<TeacherCoursesPage/>}/><Route path="teacher/course/:courseId" element={<TeacherCoursePage/>}/><Route path="teacher/submissions" element={<TeacherSubmissionsPage/>}/>
      </Route>
    </Route></Route>
    <Route path="/unauthorized" element={<Placeholder title="You don’t have access to this page"/>}/><Route path="*" element={<Placeholder title="Page not found"/>}/>
  </Routes>
}
