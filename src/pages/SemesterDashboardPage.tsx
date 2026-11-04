import { ExternalLink, LayoutDashboard } from 'lucide-react'

const sheetUrl = 'https://docs.google.com/spreadsheets/d/1xANHwrkgE8NWjH9cembxmBNnoQ_H_BxlZgN-MHgAkVM/edit'
const previewUrl = 'https://docs.google.com/spreadsheets/d/1xANHwrkgE8NWjH9cembxmBNnoQ_H_BxlZgN-MHgAkVM/preview'

export function SemesterDashboardPage() {
  return <main className="page" aria-labelledby="semester-dashboard-title">
    <div className="page-heading">
      <div>
        <p className="eyebrow">TEACHER WORKSPACE</p>
        <h1 id="semester-dashboard-title"><LayoutDashboard size={28} aria-hidden="true"/> Semester curriculum dashboard</h1>
        <p className="lede">Review the planned sequence, lesson delivery and student learning evidence. Published activities and passing tests do not, by themselves, demonstrate mastery.</p>
      </div>
      <a className="button" href={sheetUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={18} aria-hidden="true"/> Open in Google Sheets</a>
    </div>
    <section aria-label="Embedded semester dashboard" style={{border:'1px solid var(--border, #d8dee7)',borderRadius:12,overflow:'hidden'}}>
      <iframe title="APU Computer Science semester curriculum dashboard" src={previewUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" style={{display:'block',width:'100%',minHeight:'72vh',border:0}}/>
    </section>
    <p className="filter-summary">If the spreadsheet does not appear, open it using the button above and sign in with a Google account that has permission. Access to this page is restricted to APU Studio teacher/admin roles, but Google Sheets permissions are managed separately. The Studio Evidence tab is a dated snapshot, not live synchronization.</p>
  </main>
}
