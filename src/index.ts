import { Hono, Context, Next } from 'hono'
import { exec } from 'child_process'
import { promisify } from 'util'

const app = new Hono()
const execAsync = promisify(exec)

const AUTHENTICATION_TOKEN = process.env.AUTHENTICATION_TOKEN || 'ghp_1234567890'
const KUBE_NAMESPACE = process.env.KUBE_NAMESPACE || 'default'

// Middleware to authenticate requests using Bearer token
const authenticate = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ message: 'Unauthorized' }, 401)
  }

  const token = authHeader.split(' ')[1]
  if (token !== AUTHENTICATION_TOKEN) {
    return c.json({ message: 'Forbidden' }, 403)
  }

  await next()
}

// Reusable deploy handler
const deployHandler = (service: string) => {
  return async (c: Context) => {
    console.log(`🚀 Triggering redeployment for: ${service}`)

    const patchCommand = `kubectl patch deployment ${service} -n ${KUBE_NAMESPACE} -p '{"spec":{"template":{"metadata":{"annotations":{"restarted-at":"${new Date().toISOString()}"}}}}}'`

    try {
      const { stdout } = await execAsync(patchCommand)
      console.log(`✅ Patch result for ${service}:\n${stdout}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`❌ Failed to patch deployment for ${service}:`, errorMessage)
      return c.json({ message: 'Failed to patch deployment', error: errorMessage }, 500)
    }

    return c.json({ message: `Redeployment triggered for ${service}` }, 202)
  }
}

// Health check
app.get('/', (c) => c.text('🚀 Deployment API is running'))

// Backend deploy endpoint
app.post('/deploy/backend/:service', authenticate, async (c) => {
  const service = c.req.param('service')
  return deployHandler(service)(c)
})

// Frontend deploy endpoint
app.post('/deploy/frontend/:service', authenticate, async (c) => {
  const service = c.req.param('service')
  return deployHandler(service)(c)
})

// Bun server config
export default {
  port: Number(process.env.PORT || 8000),
  fetch: app.fetch,
  idleTimeout: 60
}
