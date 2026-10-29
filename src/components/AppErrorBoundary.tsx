import { Component, createRef, type ReactNode } from 'react'

/** Keep an expired lazy-loaded page or render failure from leaving a blank app. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  private heading = createRef<HTMLHeadingElement>()
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() {
    document.title = 'Page recovery | CS Studio'
    this.heading.current?.focus()
  }
  render() {
    if (!this.state.failed) return this.props.children
    return <main className="page"><p className="eyebrow">PAGE RECOVERY</p><h1 ref={this.heading} tabIndex={-1}>We couldn’t open this page</h1>
      <p role="alert">A connection problem or a new platform release may have interrupted loading. Reload to try the latest version.</p>
      <p>Before reloading, copy important code from any editor you can still access. Changes that were not saved may be lost.</p>
      <div className="heading-actions"><button className="button" onClick={() => window.location.reload()}>Reload page</button><a className="button secondary" href={window.location.pathname}>Return to dashboard</a></div>
      <p>If this continues, contact your teacher with the page address and browser you’re using.</p>
    </main>
  }
}
