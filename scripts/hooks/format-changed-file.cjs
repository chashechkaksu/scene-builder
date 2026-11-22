const { execFileSync } = require('node:child_process')
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
    if (relative.startsWith('assets-src/') || relative.startsWith('src/library/')) {
      process.exit(0)
    }
    if (!/\.(ts|vue|js|cjs|mjs|json|css)$/.test(relative)) {
      process.exit(0)
    }
    try {
      execFileSync('npx', ['prettier', '--write', relative], { stdio: 'ignore', shell: true })
    } catch {
      // форматирование не критично для хука
    }
    if (/\.(ts|vue|js|cjs|mjs)$/.test(relative)) {
      try {
        execFileSync('npx', ['eslint', '--fix', relative], { stdio: 'ignore', shell: true })
      } catch {
        // eslint может упасть на незавершённом коде, это не блокирует
      }
    }
    process.exit(0)
  })
}

readStdin()
