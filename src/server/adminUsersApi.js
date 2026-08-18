import http from 'node:http'

const LITELLM_MASTER_KEY = 'sk-vinay-master-admin-5090-key'
const LITELLM_HOST = '127.0.0.1'
const LITELLM_PORT = 4000

// Helper to make internal HTTP requests to LiteLLM Proxy
function litellmRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null
    const options = {
      hostname: LITELLM_HOST,
      port: LITELLM_PORT,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      },
      timeout: 4000
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}')
          resolve({ status: res.statusCode, data: json })
        } catch {
          resolve({ status: res.statusCode, data: data })
        }
      })
    })

    req.on('error', (err) => reject(err))
    req.on('timeout', () => { req.destroy(); reject(new Error('LiteLLM request timeout')) })

    if (postData) req.write(postData)
    req.end()
  })
}

export async function handleAdminUsersRequest(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const pathname = url.pathname

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  // 1. GET /api/admin/users - Fetch all users and keys with usage
  if (req.method === 'GET' && pathname === '/api/admin/users') {
    try {
      // Fetch all keys from LiteLLM proxy
      const keyListRes = await litellmRequest('GET', '/key/list').catch(() => ({ status: 500, data: { keys: [] } }))
      const keyTokens = Array.isArray(keyListRes.data?.keys) ? keyListRes.data.keys : []

      // Known primary user keys mapping for display names
      const knownUsers = [
        {
          userId: 'vinay_saini',
          displayName: 'Vinay Saini',
          role: 'Owner (Admin)',
          apiKey: 'sk-proj-vinaysaini-d56fd6f12a1eef114be1ccc3c8be0557a4e0d2c1',
          isOwner: true,
          tpmLimit: 'Unlimited',
          rpmLimit: 'Unlimited',
          maxBudget: 'Unlimited',
          status: 'Active',
          models: ['Qwen3.8-27B', 'All Models'],
          createdAt: '2026-08-15',
        },
        {
          userId: 'shuvikash_patel',
          displayName: 'Shuvikash Patel',
          role: 'API & Chat User',
          apiKey: 'sk-proj-shuvikash-b5619eec611aa2d3dd928063fce6d2a83ae01eb8',
          isOwner: false,
          tpmLimit: 500000,
          rpmLimit: 120,
          maxBudget: 2000,
          status: 'Active',
          models: ['Qwen3.8-27B'],
          createdAt: '2026-08-18',
        },
        {
          userId: 'pramod_thete',
          displayName: 'Pramod Thete',
          role: 'API & Chat User',
          apiKey: 'sk-proj-pramod-d5ae5999f3d10d393f6f348ddfaaee8f949ead70',
          isOwner: false,
          tpmLimit: 500000,
          rpmLimit: 120,
          maxBudget: 2000,
          status: 'Active',
          models: ['Qwen3.8-27B'],
          createdAt: '2026-08-18',
        }
      ]

      // Query live spend & quota info from LiteLLM proxy
      const detailedUsers = await Promise.all(knownUsers.map(async (u) => {
        try {
          const keyInfo = await litellmRequest('GET', `/key/info?key=${encodeURIComponent(u.apiKey)}`)
          const info = keyInfo.data?.info || {}
          return {
            ...u,
            spend: typeof info.spend === 'number' ? info.spend : 0.0,
            maxBudget: typeof info.max_budget === 'number' ? info.max_budget : u.maxBudget,
          }
        } catch {
          return { ...u, spend: 0.0 }
        }
      }))

      const totalSpend = detailedUsers.reduce((sum, u) => sum + (u.spend || 0), 0)

      res.statusCode = 200
      res.end(JSON.stringify({
        users: detailedUsers,
        totalKeys: keyTokens.length + 1,
        totalSpend: totalSpend,
        engineOwner: 'Vinay Saini',
      }))
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  // 2. POST /api/admin/generate-key - Generate a new user key
  if (req.method === 'POST' && pathname === '/api/admin/generate-key') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}')
        const nameSlug = (payload.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_')
        const randomHex = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
        const customKey = `sk-proj-${nameSlug}-${randomHex}`

        const litellmPayload = {
          key: customKey,
          user_id: nameSlug,
          key_name: `${payload.name || 'User'} Key`,
          max_budget: payload.maxBudget || 2000,
          tpm_limit: payload.tpmLimit || 500000,
          rpm_limit: payload.rpmLimit || 120,
          models: ['Qwen3.8-27B', 'default']
        }

        const genRes = await litellmRequest('POST', '/key/generate', litellmPayload)
        res.statusCode = genRes.status || 200
        res.end(JSON.stringify(genRes.data || litellmPayload))
      } catch (err) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  // 3. POST /api/admin/delete-key - Revoke a user key
  if (req.method === 'POST' && pathname === '/api/admin/delete-key') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}')
        const delRes = await litellmRequest('POST', '/key/delete', { keys: [payload.key] })
        res.statusCode = delRes.status || 200
        res.end(JSON.stringify(delRes.data || { success: true }))
      } catch (err) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  res.statusCode = 404
  res.end(JSON.stringify({ error: 'Not found' }))
}
