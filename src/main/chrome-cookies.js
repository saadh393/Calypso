import { execSync } from 'child_process'
import { pbkdf2Sync, createDecipheriv } from 'crypto'
import { existsSync, copyFileSync, unlinkSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir, tmpdir } from 'os'

const BROWSER_CONFIGS = [
  {
    name: 'Chrome',
    baseDir: join(homedir(), 'Library/Application Support/Google/Chrome'),
    keyService: 'Chrome Safe Storage',
    keyAccount: 'Chrome'
  },
  {
    name: 'Brave',
    baseDir: join(homedir(), 'Library/Application Support/BraveSoftware/Brave-Browser'),
    keyService: 'Brave Safe Storage',
    keyAccount: 'Brave'
  },
  {
    name: 'Edge',
    baseDir: join(homedir(), 'Library/Application Support/Microsoft Edge'),
    keyService: 'Microsoft Edge Safe Storage',
    keyAccount: 'Microsoft Edge'
  }
]

const COOKIE_QUERY =
  "SELECT host_key, name, hex(encrypted_value) as enc_hex, path, expires_utc, is_secure, is_httponly " +
  "FROM cookies " +
  "WHERE host_key LIKE '%.chatgpt.com' OR host_key = 'chatgpt.com'"

function readLocalState(baseDir) {
  try {
    return JSON.parse(readFileSync(join(baseDir, 'Local State'), 'utf8'))
  } catch {
    return {}
  }
}

function profileDirsWithCookies(baseDir, infoCache) {
  const fromState = Object.keys(infoCache)
  const dirs = fromState.length > 0 ? fromState : (() => {
    try { return readdirSync(baseDir) } catch { return ['Default'] }
  })()
  return dirs.filter(d => existsSync(join(baseDir, d, 'Cookies')))
}

export function listAllProfiles() {
  if (process.platform !== 'darwin') return []

  const profiles = []

  for (const config of BROWSER_CONFIGS) {
    if (!existsSync(config.baseDir)) continue

    const localState = readLocalState(config.baseDir)
    const infoCache = localState?.profile?.info_cache || {}
    const dirs = profileDirsWithCookies(config.baseDir, infoCache)

    for (const dirName of dirs) {
      const info = infoCache[dirName] || {}
      profiles.push({
        browser: config.name,
        dirName,
        label: `${config.name}  ›  ${info.name || dirName}${info.user_name ? `  (${info.user_name})` : ''}`,
        dbPath: join(config.baseDir, dirName, 'Cookies'),
        keyService: config.keyService,
        keyAccount: config.keyAccount
      })
    }
  }

  return profiles
}

function getEncryptionKey(profile) {
  const password = execSync(
    `security find-generic-password -w -s "${profile.keyService}" -a "${profile.keyAccount}"`,
    { encoding: 'utf8' }
  ).trim()
  return pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1')
}

function decrypt(buf, key) {
  if (!buf || buf.length < 3) return ''
  const prefix = buf.slice(0, 3).toString('ascii')
  if (prefix !== 'v10') return ''
  try {
    const iv = Buffer.alloc(16, 0x20)
    const d = createDecipheriv('aes-128-cbc', key, iv)
    d.setAutoPadding(false)
    const raw = Buffer.concat([d.update(buf.slice(3)), d.final()])
    const pad = raw[raw.length - 1]
    const unpadded = (pad >= 1 && pad <= 16) ? raw.slice(0, raw.length - pad) : raw
    const plain = unpadded.length >= 32 ? unpadded.slice(32) : unpadded
    return plain.toString('utf8')
  } catch (e) {
    console.warn('[decrypt] error:', e.message)
    return ''
  }
}

export function extractCookiesFromProfile(profile) {
  const tmpPath = join(tmpdir(), `voice-cookies-${Date.now()}.db`)

  try {
    copyFileSync(profile.dbPath, tmpPath)
    for (const ext of ['-wal', '-shm']) {
      const src = profile.dbPath + ext
      if (existsSync(src)) copyFileSync(src, tmpPath + ext)
    }

    let raw
    try {
      raw = execSync(`sqlite3 -json "${tmpPath}" "${COOKIE_QUERY}"`, { encoding: 'utf8' })
    } catch (e) {
      if (e.code === 'ENOENT' || (e.message && e.message.includes('sqlite3'))) {
        throw new Error('sqlite3 not found. Install it via: brew install sqlite3')
      }
      throw e
    }
    const rows = JSON.parse(raw || '[]')
    const key = getEncryptionKey(profile)

    return rows
      .map((row) => {
        const value = decrypt(Buffer.from(row.enc_hex || '', 'hex'), key)
        if (!value) return null
        const host = row.host_key
        const exp = parseInt(row.expires_utc)
        const isHostPrefixed = row.name.startsWith('__Host-')
        return {
          url: `https://${host.replace(/^\./, '')}`,
          name: row.name,
          value,
          ...(isHostPrefixed ? {} : { domain: host.startsWith('.') ? host : `.${host}` }),
          path: row.path || '/',
          secure: row.is_secure === 1 || isHostPrefixed,
          httpOnly: row.is_httponly === 1,
          ...(exp > 0 ? { expirationDate: exp / 1_000_000 - 11_644_473_600 } : {})
        }
      })
      .filter(Boolean)
  } finally {
    for (const ext of ['', '-wal', '-shm']) {
      try { unlinkSync(tmpPath + ext) } catch {}
    }
  }
}
