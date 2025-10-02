import { ViteSSG } from 'vite-ssg'
import App from './App.vue'
import routes from '~/routes'

// https://github.com/antfu/vite-ssg
export const createApp = ViteSSG(
  App,
  {
    routes,
    base: import.meta.env.BASE_URL,
  },
  async (ctx) => {
    // install all modules under `modules/`
    const modules = import.meta.glob('./modules/*.ts', { eager: true })
    Object.values(modules).forEach((i: any) => i.install?.(ctx))
  }
)
