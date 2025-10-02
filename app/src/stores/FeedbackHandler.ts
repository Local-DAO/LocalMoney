import type { ToastInterface } from 'vue-toastification'
import type { ChainError } from '~/network/chain-error'

export class FeedbackHandler {
  private toast: ToastInterface
  public constructor(toast: ToastInterface) {
    this.toast = toast
  }

  public error(e: ChainError | Error | unknown) {
    // We can validate each type of error here
    let message: string
    
    if (e instanceof Error || (e && typeof e === 'object' && 'message' in e)) {
      message = (e as ChainError | Error).message
    } else if (typeof e === 'string') {
      message = e
    } else {
      message = 'An unexpected error occurred'
    }
    
    console.error(message, e)
    // Display the error message as a toast to the user
    this.toast.error(message)
  }

  public success(message: string) {
    this.toast.success(message)
  }
}

export default function useFeedbackHandle(toast: ToastInterface): FeedbackHandler {
  return new FeedbackHandler(toast)
}
