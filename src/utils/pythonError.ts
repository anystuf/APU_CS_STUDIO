/** Keep the student's frames and final exception; runtime internals remain expandable. */
export function describePythonError(raw: string) {
  const lines = raw.trim().split('\n')
  const exception = [...lines].reverse().find(line => /^[A-Za-z]+(?:Error|Exception):/.test(line.trim()))?.trim()
  let hint = ''
  if (exception?.startsWith('ValueError:')) hint = 'Check the input values and any conversions such as int() or float().'
  else if (exception?.startsWith('NameError:')) hint = 'Check spelling, capitalization, and whether the name was defined before use.'
  else if (exception?.startsWith('IndentationError:')) hint = 'Use consistent indentation inside each function, loop, or condition.'
  else if (exception?.startsWith('SyntaxError:')) hint = 'Check the highlighted statement for missing punctuation, brackets, or a colon.'
  else if (exception?.startsWith('EOFError:')) hint = 'The program requested more input than the test supplied.'
  const studentFrames = lines.filter(line => /File ["'](?:main\.py|helpers\.py|\/apu_workspace\/)/.test(line))
  return { summary: exception ? [...studentFrames, exception].join('\n') : raw.trim(), hint }
}
