import { Hono, Context, Next } from 'hono'
import { exec } from 'child_process'
import { promisify } from 'util'

const app = new Hono()
const execAsync = promisify(exec)

const AUTHENTICATION_TOKEN = process.env.AUTHENTICATION_TOKEN || 'ghp_1234567890'

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
    const image = `ghcr.io/redcloud442/${service}:prod-server`
    const serviceName = `${service}-stack_server`

    try {
      await execAsync(`docker pull ${image}`)
      await execAsync(`docker service update --force --image ${image} ${serviceName}`)
      return c.json({ message: `${service} deployed successfully` }, 200)
    } catch (err) {
      return c.json({ message: 'Deployment failed', error: (err as Error).message }, 500)
    }
  }
}

app.get('/', (c) => c.text('Pipeline API!'))

app.post('/deploy/backend/:service', authenticate, async (c) => {
  const service = c.req.param('service')
  return deployHandler(service)(c)
})

app.post('/deploy/frontend/:service', authenticate, async (c) => {
  const service = c.req.param('service')
  return deployHandler(service)(c)
})

export default {
  port: 8080,
  fetch: app.fetch,
};