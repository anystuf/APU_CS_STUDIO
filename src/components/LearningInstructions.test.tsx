import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LearningInstructions } from './LearningInstructions'

describe('readable learning instructions', () => {
  it('renders headings, emphasis and Python references as real formatting', () => {
    const html = renderToStaticMarkup(<LearningInstructions text={'## **Your mission**\n**Problem:** Clean every entry.\n\n1. Complete `clean_name(name)` so it **returns** a string.\n2. **Submit** your code.'}/>)
    expect(html).toContain('<h2><strong>Your mission</strong></h2>')
    expect(html).toContain('<strong>Problem:</strong>')
    expect(html).toContain('<code>clean_name(name)</code>')
    expect(html).toContain('<strong>returns</strong>')
    expect(html).not.toContain('**')
    expect(html).not.toContain('## ')
    expect(html.match(/<li>/g)).toHaveLength(2)
  })
  it('preserves literal input, fences and Python comments without turning them into instructions', () => {
    const html = renderToStaticMarkup(<LearningInstructions text={'## Example\n```python\n# EXPLAIN\nprint("  Billy| Kent ")\n# 1. Keep this comment\n```\n\nUse `input().split("|")` for registrations.'}/>)
    expect(html).toContain('# EXPLAIN')
    expect(html).toContain('# 1. Keep this comment')
    expect(html).toContain('  Billy| Kent ')
    expect(html).toContain('<pre><code class="language-python">')
    expect(html).not.toContain('<h2>EXPLAIN')
    expect(html).toContain('The vertical bar')
  })
  it('keeps prose after a list after that list', () => {
    const html = renderToStaticMarkup(<LearningInstructions text={'## Steps\n1. Clean a name.\n2. Print it.\n\nKeep every duplicate.'}/>)
    expect(html.indexOf('</ol>')).toBeLessThan(html.indexOf('Keep every duplicate.'))
  })
  it('does not execute HTML or allow javascript links', () => {
    const html = renderToStaticMarkup(<LearningInstructions text={'**Note:** <script>alert(1)</script>\n\n[Bad link](javascript:alert%281%29)'}/>)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('<strong>Note:</strong>')
  })
  it('does not describe unrelated Python pipes as registration separators', () => {
    const html = renderToStaticMarkup(<LearningInstructions text={'Calculate `a | b`.'}/>)
    expect(html).not.toContain('The vertical bar')
    expect(html).toContain('<code>a | b</code>')
  })
})
