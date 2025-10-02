import { createPinia } from 'pinia'
import type { Router } from 'vue-router'
import { type UserModule } from '~/types'
import type { FeedbackHandler } from '~/stores/FeedbackHandler'
import useFeedbackHandle from '~/stores/FeedbackHandler'
import { showCustomToast } from '~/utils/toast'

// Setup Pinia
// https://pinia.esm.dev/

declare module 'pinia' {
  export interface PiniaCustomProperties {
    router: Router
    handle?: FeedbackHandler  // Made optional since stores now use showError directly
  }
}

export const install: UserModule = ({ isClient, initialState, app }) => {
  const pinia = createPinia()
  
  pinia.use(({ store }) => {
    const router = useRouter()
    
    // Create toast interface using our custom implementation
    const toast = isClient ? {
      success: (msg: string) => {
        console.log('✅ Success:', msg)
        showCustomToast(msg, 'success')
      },
      error: (msg: string) => {
        console.error('❌ Error:', msg)
        showCustomToast(msg, 'error')
      },
      warning: (msg: string) => {
        console.warn('⚠️ Warning:', msg)
        showCustomToast(msg, 'warning')
      },
      info: (msg: string) => {
        console.info('ℹ️ Info:', msg)
        showCustomToast(msg, 'info')
      },
      clear: () => {},
    } : {
      // Server-side: provide a no-op toast
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
      clear: () => {},
    }
    
    store.router = markRaw(router)
    store.handle = markRaw(useFeedbackHandle(toast))
  })
  
  app.use(pinia)
  // Refer to
  // https://github.com/antfu/vite-ssg/blob/main/README.md#state-serialization
  // for other serialization strategies.
  if (isClient) {
    pinia.state.value = initialState.pinia || {}
  } else {
    initialState.pinia = pinia.state.value
  }
}
