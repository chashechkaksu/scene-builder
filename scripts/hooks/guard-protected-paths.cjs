const path = require('node:path')

function readStdin() {
  const chunks = []
  process.stdin.on('data', (chunk) => chunks.push(chunk))
  process.stdin.on('end', () => {
    let payload
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    } catch {
      process.exit(0)
    }
    const filePath = payload?.tool_input?.file_path
    if (!filePath) {
      process.exit(0)
    }
    const relative = path.relative(process.cwd(), filePath).replace(/\\/g, '/')
    // src/library/semantics.ts — единственный ручной файл в этой иначе генерируемой папке
    // (раздел 6.6 CLAUDE.md), build-library.ts его не трогает и не перезаписывает.
    const manualException = relative === 'src/library/semantics.ts'
    const protectedPrefixes = ['assets-src/', 'src/library/']
    const isProtected =
      !manualException && protectedPrefixes.some((prefix) => relative.startsWith(prefix))
    if (isProtected) {
      process.stderr.write(
        `Запрещено редактировать "${relative}" напрямую: ${
          relative.startsWith('assets-src/')
            ? 'это неприкосновенные исходники из Figma'
            : 'это генерируется scripts/build-library.ts, запусти "npm run library" после правки скрипта'
        }.\n`,
      )
      process.exit(2)
    }
    process.exit(0)
  })
}

readStdin()
