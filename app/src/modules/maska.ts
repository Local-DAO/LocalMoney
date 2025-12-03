import { vMaska } from 'maska'
import { type UserModule } from '~/types'

export const install: UserModule = ({ app }) => {
  app.directive('maska', vMaska)
}
